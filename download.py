import urllib.request  
import ssl  
ssl._create_default_https_context = ssl._create_unverified_context  
urllib.request.urlretrieve('https://github.com/googlefonts/noto-cjk/raw/main/Sans/Variable/TTF/NotoSansKR-VF.ttf', 'font.ttf')  
urllib.request.urlretrieve('https://via.placeholder.com/1080x200/0033a0/ffffff.png?text=BANNER', 'banner.png')  
