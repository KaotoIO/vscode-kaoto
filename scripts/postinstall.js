const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const downloadFile = (async (url, filePath) => {
  console.log(`Will fetch backend binary from ${url} into ${path.resolve(filePath)}`);
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
  });
  console.log(`Binary downloaded ${path.resolve(filePath)}`)
  fs.chmodSync(filePath, "766");
});

const downloadKaotoBackendNativeExecutable = (backendVersion, platform, extension) => {
	downloadFile(`https://github.com/KaotoIO/kaoto-backend/releases/download/${backendVersion}/kaoto-${platform}`, `./binaries/kaoto-${platform}${extension}`);
}

const backendVersion = "v1.0.1";
downloadKaotoBackendNativeExecutable(backendVersion, 'linux-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'macos-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'windows-amd64', '.exe');
