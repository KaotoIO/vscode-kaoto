const fetch = require('node-fetch');
const fs = require('fs');

const downloadFile = (async (url, path) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
  });
  fs.chmodSync(path, fs.constants.S_IRWXU);
});

downloadFile("https://github.com/KaotoIO/kaoto-backend/releases/download/v0.4.0/kaoto-linux-amd64", "./binaries/kaoto-linux-amd64");
