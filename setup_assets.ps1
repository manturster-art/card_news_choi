
$fontUrl = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/Variable/TTF/NotoSansKR-VF.ttf"
$bannerUrl = "https://via.placeholder.com/1080x200/0033a0/ffffff.png?text=BANNER"

Write-Host "Downloading test font..."
Invoke-WebRequest -Uri $fontUrl -OutFile "d:/박정진/코딩/web_card/font.ttf"
Write-Host "Downloading test banner..."
Invoke-WebRequest -Uri $bannerUrl -OutFile "d:/박정진/코딩/web_card/banner.png"
Write-Host "Dummy assets setup complete."

