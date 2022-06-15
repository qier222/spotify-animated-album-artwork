# Spotify Animated Album Artwork

Replace your Spotify album artwork with an animated version.

https://user-images.githubusercontent.com/68148142/174134323-97a44859-cfb1-4877-b195-0da2f71561ec.mp4

## Install

<sub>My english is broken, please bear with it... 😰</sub>

1. Install [spicetify-cli](https://spicetify.app/docs/getting-started)
2. Download the `spotify-animated-album-artwork.js` from [GitHub Releases](https://github.com/qier222/spotify-animated-album-artwork/releases).
3. Use following command to install this spicetify extension, for more info visit: [spicetify docs](https://spicetify.app/docs/advanced-usage/extensions)

```bash
spicetify config extensions spotify-animated-album-artwork.js
spicetify apply
```

## FAQ

**Q**: Where are those animated album artworks come from?<br/>
**A**: Apple Music.
<br/>
<br/>
**Q**: Why is this api took so long to respond?<br/>

## Deploy to server

Requirements:

- Server
- Domain
- Apple ID
- [Supabase](https://supabase.com) database

### Download source code

```bash
git clone https://github.com/qier222/spotify-animated-album-artwork.git
```

### Install Node.js and dependencies

Install PNPM

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc
```

Use PNPM to install Nodejs

```bash
pnpm env use --global lts
```

Install dependencies

```bash
pnpm install
```

### Create config file

Copy `config.example.json` file in the project root and rename it to `config.json`

Write your domain name in the `api` field.

### Get Apple Music token

1. Go to [Apple Music](https://music.apple.com/us/app/apple-music/id966771699) and login with your Apple ID
2. Open browser developer tools (F12 or CMD+SHIFT+I), click on the **Network** tab, then click on the **Fetch/XHR** option
3. Go to [`https://music.apple.com/cn/search?term=taylor%20swift`](https://music.apple.com/cn/search?term=taylor%20swift)
4. Find `authorization` in **Request Headers** and copy it (looks like 'Bearer xxxxxxx'), this is your token
5. Paste token into `config.json`

### Setup Supabase

1. Register a new [Supabase](https://supabase.com) account
2. Create a new project
3. Go to Supabase's "SQL Editor", paste the following code into the editor and **click run**

```sql
CREATE TABLE "public"."spotify" (
    "id" text NOT NULL,
    "appleMusicID" int8 NOT NULL,
    "url" text,
    "downloaded" bool DEFAULT false,
    "created_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("id")
);
```

4. Go to Supabase's "Settings" - "API", copy your project's URL and service_role secret into the `config.json` file

### Download FFmpeg

1. Open [FFmpeg](https://johnvansickle.com/ffmpeg/) and download the latest release version,
2. **Put it under the project root** , use `tar` to unpack it, rename the unpacked folder to `ffmpeg`

```bash
tar -xf ffmpeg-release-amd64-static.tar.xz
```

3. Make sure your FFmpeg version is higher than `5.0.0`, you can check it by running `./ffmpeg/ffmpeg -version`

### Start the server

Simply run

```bash
node server.js
```

If you want to make sure that the server is always running, you can run pm2 to manage it.

```bash
pm2 start server.js --name spotify-animated-artwork-server
```

### Start you caddy server to reverse proxy and use https

Copy `Caddydile.example` to `Caddyfile` and replace `https://your-domain.example.com` with your domain.

If you are using Cloudflare to manager your domain DNS, replace `your_cloudflare_api_key` with your Cloudflare api key. Otherwise, checkout [Caddy Documentation](https://caddyserver.com/docs/) for other ways to enable HTTPS.

Note: HTTPS is needed for this api to work.

```bash
caddy start --config Caddyfile
```

## Develop

You need to run this command every time you want to make changes effecting Spotify (probably).

```bash
npm run build && spicetify apply --enable-developer-mode
```

Enable developer mode to open console, deactivate every time you close Spotify.

```bash
spicetify enable-devtools --enable-developer-mode
```

## Made with Spicetify Creator

- https://github.com/spicetify/spicetify-creator
