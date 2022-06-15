import config from "../config.json";

async function main() {
  while (
    !Spicetify?.URI ||
    !Spicetify?.Platform ||
    !Spicetify?.CosmosAsync ||
    !Spicetify?.Menu ||
    !Spicetify?.LocalStorage
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const { URI, Platform, CosmosAsync, Menu } = Spicetify;
  const api = Spicetify.LocalStorage.get("animated-cover-api") || config.api;

  let isEnabled = Spicetify.LocalStorage.get("enable-animated-cover") === "yes";
  new Menu.Item("Enable Animated Album Artwork", true, (self) => {
    isEnabled = !isEnabled;
    Spicetify.LocalStorage.set(
      "enable-animated-cover",
      isEnabled ? "yes" : "no"
    );
    self.setState(isEnabled);
  }).register();

  Platform.History.listen(async (location: { pathname: string }) => {
    if (Spicetify.LocalStorage.get("enable-animated-cover") === "no") {
      return;
    }
    if (location.pathname === "/") {
      return;
    }
    const uri = URI.fromString(location.pathname);
    if (uri.type !== "album") {
      return;
    }

    const id = uri.getBase62Id();
    const album = await CosmosAsync.get(
      `wg://album/v1/album-app/album/${id}/desktop`
    );
    const artist = album.artists[0].name;

    const cover = await fetch(
      `${api}/download-video-cover?id=${id}&name=${encodeURIComponent(
        album.name
      )}&artist=${encodeURIComponent(artist)}`
    ).then((response) => response.json());

    if (cover?.url) {
      console.log(`Cover found (${album.name}): ${cover.url}`);
      const img = document.querySelector(
        "#main > div > div.Root__top-container > div.Root__main-view > div.main-view-container > div.os-host > div.os-padding > div > div > div.main-view-container__scroll-node-child > main > section > div.contentSpacing > div > div > img"
      );

      const video = document.createElement("video");
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.src = cover.url;
      video.id = "player";
      video.style.width = "100%";
      video.style.height = "100%";
      video.preload = "none";
      video.crossOrigin = "anonymous";
      video.setAttribute("playsinline", "");

      // Incase user has left the page before the request finished
      const currentPath = Platform.History.location.pathname;
      if (currentPath === "/") {
        return;
      }
      const currentURI = URI.fromString(currentPath);
      if (currentURI.type === "album" && uri.id === currentURI.id) {
        img?.replaceWith(video);
      }
    }
  });
}

export default main;
