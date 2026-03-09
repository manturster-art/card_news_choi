const https = require('https');
const fs = require('fs');

const fontUrl = 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/Variable/TTF/NotoSansKR-VF.ttf';
const bannerUrl = 'https://via.placeholder.com/1080x200/0033a0/ffffff.png?text=BANNER';

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => { file.close(resolve); });
                }).on('error', (err) => {
                    fs.unlink(dest, () => { });
                    reject(err.message);
                });
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(resolve); });
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err.message);
        });
    });
};

async function run() {
    console.log('Downloading font...');
    try {
        await download(fontUrl, 'font.ttf');
        console.log('Font downloaded.');
    } catch (e) {
        console.error(e);
    }

    console.log('Downloading banner...');
    try {
        await download(bannerUrl, 'banner.png');
        console.log('Banner downloaded.');
    } catch (e) {
        console.error(e);
    }
    console.log('Done.');
}
run();
