const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const HLSDownload = require("node-hls-downloader").download;
const execSync = require("child_process").execSync;
const cors = require("cors");

const log = console.log;
const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const cachePath = config.cachePath.startsWith("./")
  ? path.join(__dirname, config.cachePath) + "/"
  : config.cachePath.endsWith("/")
  ? config.cachePath
  : `${config.cachePath}/`;

class App {
  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleApiKey
    );
    this.startServer();
    this.downloadQueue = [];
    this.downloadingID = "";
    this.checkDownloadQueue();
  }

  async startServer() {
    const app = express();
    app.use(cors());
    const port = config.express.port;

    app.get("/", async (req, res) => {
      res.send("Hello Spotify!");
    });

    app.get("/download-video-cover", async (req, res) => {
      const { id: spotifyID, name, artist } = req.query;
      if (!spotifyID || !name || !artist) {
        res.status(400).send({ error: "Missing id, name or artist" });
        return;
      }

      log(`[${spotifyID}] getting from Supabase`);
      const { data: supabaseData, error } = await this.supabase
        .from(config.supabase.tableName)
        .select("*")
        .eq("id", spotifyID)
        .maybeSingle();
      if (!error && supabaseData?.id) {
        if (supabaseData.url && supabaseData.downloaded !== true) {
          this.downloadQueue.push({
            id: spotifyID,
            appleMusicID: supabaseData.appleMusicID,
            url: supabaseData.url,
          });
          await this.waitForDownload(spotifyID);
        }
        res.send({
          url: `${config.api}/videos/${supabaseData.appleMusicID}.webm`,
        });
        return;
      }

      log(`[${spotifyID}] getting from Apple`);
      const { url: videoUrl, id: appleMusicID } = await this.getVideoFromApple({
        name,
        artist,
      });
      await this.supabase.from(config.supabase.tableName).upsert({
        id: spotifyID,
        url: videoUrl,
        appleMusicID: appleMusicID,
      });
      if (videoUrl) {
        this.downloadQueue.push({ id: spotifyID, appleMusicID, url: videoUrl });
        await this.waitForDownload(spotifyID);
        res.send({ url: `${config.api}/videos/${appleMusicID}.webm` });
        return;
      }

      res.send({ url: "" });
    });

    app.get("/videos/:appleMusicID", async (req, res) => {
      const file = `${cachePath}${req.params.appleMusicID}`;
      res.status(206).sendFile(file);
    });

    app.listen(port, async () => {
      log(`Express server listening on port: ${port}`);
      log(`Server running at: ${config.api}`);
    });
  }

  async searchAlbumFromApple(keyword) {
    log("searchAlbumFromApple ", keyword);
    const r = await axios.get(
      `https://amp-api.music.apple.com/v1/catalog/cn/search`,
      {
        params: {
          term: keyword,
          l: "zh-cn",
          platform: "web",
          types: "albums",
          limit: 1,
        },
        headers: {
          authorization: config.appleMusic.token,
        },
        timeout: 10 * 1000,
      }
    );

    return r.data?.results?.albums?.data?.[0];
  }

  async getVideoFromApple({ name, artist }) {
    const keyword = `${artist} ${name}`;
    const album = await this.searchAlbumFromApple(keyword).catch((e) => {
      log(`[${name} ${artist}] searchAlbumFromApple  error`, e);
    });
    log(`Got apple music album ${album.name}`);

    const url = album?.attributes.url;

    if (!url) {
      return;
    }

    let { data: html } = await axios.get(url, { timeout: 10 * 1000 });
    if (!html) return;

    const regex =
      /<script type="fastboot\/shoebox" id="shoebox-media-api-cache-amp-music">(.*?)<\/script>/;
    html = html
      .match(regex)[0]
      .replace(
        '<script type="fastboot/shoebox" id="shoebox-media-api-cache-amp-music">',
        ""
      )
      .replace("</script>", "");
    html = JSON.parse(html);
    const data = JSON.parse(html[Object.keys(html)[1]]);
    const m3u8 =
      data?.d?.[0]?.attributes?.editorialVideo?.motionSquareVideo1x1?.video;

    return {
      id: album.id,
      url: m3u8,
    };
  }

  async waitForDownload(spotifyID) {
    while (
      this.downloadQueue.findIndex((item) => item.id === spotifyID) !== -1 &&
      this.downloadingID !== spotifyID
    ) {
      await sleep(1000);
    }
  }

  async checkDownloadQueue() {
    setInterval(async () => {
      if (this.downloadQueue.length > 0 && !this.downloadingID) {
        const item = this.downloadQueue.shift();
        this.downloadingID = item.id;
        const result = await this.downloadVideo(
          item.id,
          item.appleMusicID,
          item.url
        );
        if (!result) {
          if (!item.retry) {
            item.retry = 0;
          } else {
            item.retry += 1;
          }
          if (item.retry <= 10) {
            this.downloadQueue.push(item);
          }
        }
        this.downloadingID = "";
      }
    }, 1000);
  }

  async downloadVideo(spotifyID, appleMusicID, url) {
    const setDownloaded = async () => {
      log(`[${spotifyID}] set downloaded`);
      await this.supabase
        .from(config.supabase.tableName)
        .update({ downloaded: true })
        .match({ id: spotifyID });
    };
    const filePath = path.join(cachePath, `${appleMusicID}`);
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
    }
    if (fs.existsSync(`${filePath}.webm`)) {
      log(`appleMusicID: ${appleMusicID} already downloaded`);
      await setDownloaded();
      return true;
    }

    try {
      log(`[${spotifyID}] downloading from ${url}`);
      await HLSDownload({
        quality: "960",
        concurrency: 5,
        outputFile: `${filePath}.mp4`,
        streamUrl: url,
        ffmpegPath: config.ffmpegPath || "ffmpeg",
      });
    } catch (e) {
      log(`[${spotifyID}] downloadVideo error`, e);
      return false;
    }

    try {
      log(`[${spotifyID}] converting to webm`);
      execSync(
        `${
          config.ffmpegPath || "ffmpeg"
        } -i ${filePath}.mp4 -b:v 0 -crf 44 ${filePath}.webm`
      );
      fs.rmSync(`${filePath}.mp4`);
    } catch (e) {
      log(`[${spotifyID}] ffmpeg error`, e);
      return false;
    }

    await setDownloaded();
  }
}

new App();
