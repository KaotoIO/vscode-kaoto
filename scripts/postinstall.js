const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class HTTPResponseError extends Error {
	constructor(response) {
		super(`${response.status} ${response.statusText} - ${response.url}`);
	}
}

const checkStatus = (response) => {
	if (response.ok) {
		return response;
	} else {
		throw new HTTPResponseError(response);
	}
}

const downloadFile = (async (url, filePath) => {
  console.log(`Will fetch backend binary from ${url} into ${path.resolve(filePath)}`);
  const res = await fetch(url);
  if(checkStatus(res)) {
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
    console.log(`Binary downloaded ${path.resolve(filePath)}`)
    fs.chmodSync(filePath, "766");
  }
});

const downloadKaotoBackendNativeExecutable = (backendVersion, platform, extension) => {
	downloadFile(`https://github.com/KaotoIO/kaoto-backend/releases/download/${backendVersion}/kaoto-${platform}`, `./binaries/kaoto-${platform}${extension}`);
}

const backendVersion = "v1.1.0-M2";
downloadKaotoBackendNativeExecutable(backendVersion, 'linux-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'macos-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'windows-amd64', '.exe');
