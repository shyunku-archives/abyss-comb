const axios = require("axios");
const fs = require("fs");
const apiPrefix = "https://kr.api.riotgames.com";
const ProgressBar = require("progress");
const path = require("path");
const extractor = require("progress-extract");
const copydir = require("copy-dir");
const rimraf = require("rimraf");

let credential = JSON.parse(
  fs.readFileSync("./credential.json", "utf8").toString()
);
let apiKey = credential.API_KEY;
console.log(apiKey);

function insertParam(url, key, value) {
  let url_ = new URL(url);
  url_.searchParams.append(key, value);
  return url_.toString();
}

module.exports = {
  url: function (path) {
    return apiPrefix + path;
  },
  riot: function (path, resolve) {
    let fullUrl = this.url(path);
    let newUrl = insertParam(fullUrl, "api_key", apiKey);

    axios
      .get(newUrl)
      .then((data) => {
        resolve(true, data.data);
      })
      .catch((err) => {
        resolve(false, err);
      });
  },
  riotSync: function (path) {
    let fullUrl = this.url(path);
    let newUrl = insertParam(fullUrl, "api_key", apiKey);

    return axios.get(newUrl);
  },
  axios: function (url, resolve) {
    axios
      .get(url)
      .then((data) => {
        resolve(true, data.data);
      })
      .catch((err) => {
        resolve(false, err);
      });
  },
  fastInterval: function (func, delay) {
    func();
    setInterval(func, delay);
  },
  readJson: function (path) {
    let data = fs.readFileSync(path).toString();
    return JSON.parse(data);
  },
  getGameType: function (type) {
    switch (type) {
      case 450:
        MapType = "howling-abyss";
        MapLabel = "무작위 총력전";
        MapName = "일반(칼바람 나락)";
        break;
      case 420:
        MapLabel = "솔로 랭크";
        MapType = "summoners-rift";
        MapName = "랭크(소환사의 협곡)";
        break;
      case 430:
        MapLabel = "일반";
        MapType = "summoners-rift";
        MapName = "일반(소환사의 협곡)";
        break;
      case 440:
        MapLabel = "자유 랭크";
        MapType = "summoners-rift";
        MapName = "랭크(소환사의 협곡)";
        break;
      case 830:
        MapLabel = "입문 봇전";
        MapType = "summoners-rift";
        MapName = "입문 봇전(소환사의 협곡)";
        break;
      case 840:
        MapLabel = "초보 봇전";
        MapType = "summoners-rift";
        MapName = "초보 봇전(소환사의 협곡)";
        break;
      case 850:
        MapLabel = "중급 봇전";
        MapType = "summoners-rift";
        MapName = "중급 봇전(소환사의 협곡)";
        break;
      case 900:
        MapLabel = "U.R.F";
        MapType = "summoners-rift";
        MapName = "우르프";
        break;
      case 920:
        MapLabel = "포로왕";
        MapType = "howling-abyss";
        MapName = "포로왕(칼바람 나락)";
        break;
      default:
        MapLabel = "qType " + type;
        MapName = "QueueType " + type;
        MapType = "";
        break;
    }
    return { MapType, MapLabel, MapName };
  },
  getDragonTrailTgz: async function (dataDragonVersion) {
    const downloadDestPath = path.resolve(
      __dirname,
      "resources",
      "temp",
      "dtt"
    );
    const downloadPath = path.resolve(
      __dirname,
      "resources",
      "temp",
      "dtt",
      `dragonTrails-${dataDragonVersion}.tgz`
    );
    const decompressPath = path.resolve(
      __dirname,
      "resources",
      "temp",
      "dt_raw",
      `${dataDragonVersion}`
    );
    const copyPath = path.resolve(
      decompressPath,
      `${dataDragonVersion}`,
      "img"
    );
    const finalPath = path.resolve(__dirname, "resources", "dragonTrails");

    if (fs.existsSync(finalPath)) {
      console.log("DragonTrails data already exists, all process skipped.");
      return;
    }

    let finalize = function () {
      copydir(
        copyPath,
        finalPath,
        {
          cover: true,
        },
        (err) => {
          if (err) throw err;
          console.log("DragonTrails data copied complete!");

          rimraf(decompressPath, () => {
            console.log("Removed decompressed dt.");
          });
        }
      );
    };

    let afterFinish = function () {
      if (!fs.existsSync(decompressPath)) {
        extractor(downloadPath, decompressPath).then(() => {
          console.log("extracted complete!");
          fs.unlinkSync(downloadPath);
          finalize();
        });
      } else {
        console.log(
          "DragonTrails raw already exists, decompress process skipped."
        );
        finalize();
      }
    };

    if (fs.existsSync(downloadPath)) {
      console.log("DragonTrails tgz already exists, download skipped.");
      afterFinish();
      return;
    }

    if (!fs.existsSync(downloadDestPath)) {
      fs.mkdirSync(downloadDestPath, true);
    }

    const { data, headers } = await axios({
      url: `https://ddragon.leagueoflegends.com/cdn/dragontail-${dataDragonVersion}.tgz`,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(downloadPath);
    const totalLength = headers["content-length"];
    const progressBar = new ProgressBar(
      `-> downloading dragontrails-${dataDragonVersion} data [:bar] :percent :etas`,
      {
        width: 80,
        complete: "=",
        incomplete: " ",
        renderThrottle: 1,
        total: parseInt(totalLength),
      }
    );

    data.on("data", (chunk) => {
      progressBar.tick(chunk.length);
    });
    data.pipe(writer);

    writer.on("finish", () => {
      console.log("DragonTrails tgz download finished.");
      afterFinish();
    });

    writer.on("error", (e) => {
      console.error(e);
    });
  },
  downloadImage: async function (url, dest, label = "", progress = false) {
    const { data, headers } = await axios({
      url: url,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(dest);
    const totalLength = headers["content-length"];

    if (progress) {
      const progressBar = new ProgressBar(
        `-> downloading image data [:bar] :percent :etas`,
        {
          width: 80,
          complete: "=",
          incomplete: " ",
          renderThrottle: 1,
          total: parseInt(totalLength),
        }
      );

      data.on("data", (chunk) => {
        progressBar.tick(chunk.length);
      });
    }
    data.pipe(writer);

    writer.on("finish", () => {
      if (label.length > 0) console.log(`image: ${label} download finished.`);
    });

    writer.on("error", (e) => {
      console.error(e);
    });
  },
};
