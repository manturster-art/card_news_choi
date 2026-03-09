document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('cardCanvas');
    const ctx = canvas.getContext('2d');

    // Inputs
    const imageUpload = document.getElementById('imageUpload');
    const dateInput = document.getElementById('dateInput');
    const scheduleInput = document.getElementById('scheduleInput');
    const bottomBannerUpload = document.getElementById('bottomBannerUpload');
    const downloadBtn = document.getElementById('downloadBtn');

    // Assets
    const assets = {
        banner: new Image(),
        bottomBanner: new Image(),
        uploadedImg: null,
        fontReady: false
    };

    // 로컬의 banner.png 로드
    assets.banner.src = 'banner.png';
    assets.banner.onload = () => drawCanvas();

    // 초기 하단 배너 (bottom_banner.png 가 있다면 로드, 없으면 파란색 테마 기본 슬로건)
    assets.bottomBanner.onerror = () => {
        // 무한 루프 방지 및 기본 렌더링으로 fall-back
        assets.bottomBanner.onerror = null;
        assets.bottomBanner.src = ''; // src 초기화
        drawCanvas();
    };
    assets.bottomBanner.src = 'bottom_banner.png';

    // 폰트 로딩 대기 후 화면 갱신
    document.fonts.load('10pt "CardFont"').then(() => {
        assets.fontReady = true;
        drawCanvas();
    });

    // 캔버스 상수 및 이미지 조작 상태
    const CANVAS_W = 1080;

    // 높이 조정: 기존 SECTION2_Y 파트는 700이었으나 상단 이미지를 2/3 수준으로 축소하기 위해 460으로 변경
    const SECTION2_Y = 460; // 배너 영역 Y 시작점
    const SECTION2_H = 200; // 배너 높이
    const SECTION3_Y = SECTION2_Y + SECTION2_H; // 세부 일정 영역 Y (660px)
    const IMAGE_DRAW_H = SECTION3_Y; // 이미지는 배너 끝나는 곳(660px)까지 그려짐 (배너에 의해 200px는 상단 덮임)

    let imgState = {
        zoom: 1,
        panX: 0,
        panY: 0,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    // ----- 이벤트 리스너 (업로드 및 드래그 앤 드롭) -----

    // 1. 좌측 컨트롤 패널의 DropZone 기능 복구
    function setupDropZone(dropZoneId, inputElement, isBottom) {
        const dropZone = document.getElementById(dropZoneId);
        if (!dropZone) return;

        // 클릭하면 숨겨진 input[type="file"] 클릭 (이벤트 버블링 방지)
        dropZone.addEventListener('click', (e) => {
            if (e.target !== inputElement) {
                inputElement.click();
            }
        });

        // 위치 위에 진입했을 때 UI 강조
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (isBottom) {
                dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
            } else {
                dropZone.classList.add('border-blue-500', 'bg-blue-50');
            }
        });

        // 위치에서 벗어나거나 종료 시 UI 복구
        ['dragleave', 'dragend'].forEach(type => {
            dropZone.addEventListener(type, (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'border-indigo-500', 'bg-indigo-50');
            });
        });

        // 실제로 드롭한 경우
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'border-indigo-500', 'bg-indigo-50');

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                inputElement.files = e.dataTransfer.files;
                const event = new Event('change');
                inputElement.dispatchEvent(event);
            }
        });
    }

    setupDropZone('topDropZone', imageUpload, false);
    setupDropZone('bottomDropZone', bottomBannerUpload, true);

    // 2. 우측 캔버스 자체에 드래그 앤 드롭 이벤트 적용 (병행)
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvas.style.opacity = '0.7';
    });

    ['dragleave', 'dragend'].forEach(type => {
        canvas.addEventListener(type, (e) => {
            e.preventDefault();
            canvas.style.opacity = '1';
        });
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        canvas.style.opacity = '1';

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const pos = getMousePos(e);
            const droppedFiles = e.dataTransfer.files;

            // 드롭된 위치의 Y 좌표에 따라서 상단/하단 이미지를 결정
            if (pos.y <= IMAGE_DRAW_H) {
                // 상단 영역에 드롭 -> 메인 이미지 교체
                imageUpload.files = droppedFiles;
                imageUpload.dispatchEvent(new Event('change'));
            } else {
                // 하단 영역에 드롭 -> 하단 배너 교체
                bottomBannerUpload.files = droppedFiles;
                bottomBannerUpload.dispatchEvent(new Event('change'));
            }
        }
    });

    // 메인 이미지 업로드
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    assets.uploadedImg = img;
                    // 이미지 바뀌면 조작 상태 초기화
                    imgState.zoom = 1;
                    imgState.panX = 0;
                    imgState.panY = 0;
                    drawCanvas();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            assets.uploadedImg = null;
            drawCanvas();
        }
    });

    // 하단 배너 업로드
    bottomBannerUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    assets.bottomBanner = img;
                    drawCanvas();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            // 업로드 해제 시 
            assets.bottomBanner = new Image();
            drawCanvas();
        }
    });

    // 텍스트
    [dateInput, scheduleInput].forEach(el => {
        el.addEventListener('input', drawCanvas);
    });

    // ----- 캔버스 마우스/터치 이벤트 (Pan & Zoom) -----

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        // 캔버스의 실제 크기와 화면에 그려지는 크기(rect)의 비율을 고려
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = e.clientX;
        let clientY = e.clientY;

        // 터치 이벤트 지원
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handleDragStart(e) {
        if (!assets.uploadedImg) return;
        const pos = getMousePos(e);
        // 이미지가 그려진 상단 구역(0 ~ IMAGE_DRAW_H)에서만 드래그 허용
        if (pos.y <= IMAGE_DRAW_H) {
            imgState.isDragging = true;
            imgState.startX = pos.x - imgState.panX;
            imgState.startY = pos.y - imgState.panY;
            canvas.style.cursor = 'grabbing';
        }
    }

    function handleDragMove(e) {
        if (!imgState.isDragging || !assets.uploadedImg) return;
        e.preventDefault(); // 스크롤 등 기본 동작 방지
        const pos = getMousePos(e);
        imgState.panX = pos.x - imgState.startX;
        imgState.panY = pos.y - imgState.startY;
        drawCanvas();
    }

    function handleDragEnd() {
        imgState.isDragging = false;
        canvas.style.cursor = 'default';
    }

    canvas.addEventListener('mousedown', handleDragStart);
    canvas.addEventListener('mousemove', handleDragMove);
    canvas.addEventListener('mouseup', handleDragEnd);
    canvas.addEventListener('mouseleave', handleDragEnd);

    // 터치 지원
    canvas.addEventListener('touchstart', handleDragStart, { passive: false });
    canvas.addEventListener('touchmove', handleDragMove, { passive: false });
    canvas.addEventListener('touchend', handleDragEnd);

    // 마우스 휠 줌 기능
    canvas.addEventListener('wheel', (e) => {
        if (!assets.uploadedImg) return;
        const pos = getMousePos(e);

        // 상단 이미지 구역에서만 줌 동작
        if (pos.y <= IMAGE_DRAW_H) {
            e.preventDefault();

            const zoomSensitivity = 0.05;
            let newZoom = imgState.zoom;

            if (e.deltaY < 0) {
                newZoom += zoomSensitivity; // 확대
            } else {
                newZoom -= zoomSensitivity; // 축소
            }

            // 최소 0.5배, 최대 3배 제한
            newZoom = Math.max(0.5, Math.min(newZoom, 3));

            // Zoom in on center
            imgState.zoom = newZoom;
            drawCanvas();
        }
    }, { passive: false });


    // ----- 캔버스 그리기 함수 -----
    function drawCanvas() {
        // 1. 일정 줄 수에 따른 동적 높이 계산
        const scheduleText = scheduleInput.value || '';
        const lines = scheduleText ? scheduleText.split('\n') : [];

        // 일정 시작(SECTION3_Y) + 여백(80) + (줄 수 * 80 줄간격)
        let textEndY = SECTION3_Y + 80 + (lines.length * 80);

        let bottomBannerHeight = 0;
        let drawnBottomBannerBaseY = textEndY + 40; // 텍스트에서 40px 여백 후 배너 시작

        if (assets.bottomBanner && assets.bottomBanner.complete && assets.bottomBanner.naturalHeight > 0) {
            // 배너가 있을 경우 폭 1080에 맞춘 높이를 계산
            const ratio = CANVAS_W / assets.bottomBanner.width;
            bottomBannerHeight = assets.bottomBanner.height * ratio;
        } else {
            // 기존 텍스트 슬로건 공간
            bottomBannerHeight = 150;
        }

        const CANVAS_H = Math.max(1400, drawnBottomBannerBaseY + bottomBannerHeight);
        canvas.height = CANVAS_H; // 동적 캔버스 리사이즈

        // 배경 흰색
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 2. 상단 사진 (0 ~ IMAGE_DRAW_H) - object-fit & 사용자 컨트롤
        if (assets.uploadedImg) {
            ctx.save();
            // 클리핑(0~IMAGE_DRAW_H 만 보여지도록)
            ctx.beginPath();
            ctx.rect(0, 0, CANVAS_W, IMAGE_DRAW_H);
            ctx.clip();

            const img = assets.uploadedImg;

            // 이미지 전체를 감싸도록(cover) 스케일 계산
            const scale = Math.max(CANVAS_W / img.width, IMAGE_DRAW_H / img.height);
            const baseW = img.width * scale;
            const baseH = img.height * scale;

            // 줌 및 제한없는 패닝 적용
            const destW = baseW * imgState.zoom;
            const destH = baseH * imgState.zoom;

            const destX = (CANVAS_W - destW) / 2 + imgState.panX;
            const destY = (IMAGE_DRAW_H - destH) / 2 + imgState.panY;

            ctx.drawImage(img, destX, destY, destW, destH);

            ctx.restore();
        } else {
            // 사진 없을 경우 회색 배경 안내
            ctx.fillStyle = '#E5E7EB';
            ctx.fillRect(0, 0, CANVAS_W, IMAGE_DRAW_H);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('상단 현장 사진을 업로드 해주세요', CANVAS_W / 2, IMAGE_DRAW_H / 2);
            ctx.font = '20px sans-serif';
            ctx.fillText('(마우스 드래그로 이동, 휠로 확대/축소)', CANVAS_W / 2, (IMAGE_DRAW_H / 2) + 50);
        }

        // 3. 중단 배너 및 날짜
        if (assets.banner.complete && assets.banner.naturalHeight !== 0 && assets.banner.src) {
            ctx.drawImage(assets.banner, 0, SECTION2_Y, CANVAS_W, SECTION2_H);
        } else {
            // 배너 없을 시 파란색 기본 사각형
            ctx.fillStyle = '#0033A0';
            ctx.fillRect(0, SECTION2_Y, CANVAS_W, SECTION2_H);
        }

        // 날짜 텍스트 (단일 줄)
        const dateText = dateInput.value || '';
        if (dateText) {
            const fontName = assets.fontReady ? 'CardFont' : 'sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold 60px "${fontName}"`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(dateText, 80, SECTION2_Y + (SECTION2_H / 2));
        }

        // 4. 하단 세부 일정 (SECTION3_Y ~ 가변 Ypx)
        if (lines.length > 0) {
            const fontName = assets.fontReady ? 'CardFont' : 'sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            let currentY = SECTION3_Y + 80;

            lines.forEach((line) => {
                ctx.font = `bold 48px "${fontName}"`;
                ctx.fillText(line, 80, currentY);
                currentY += 80; // 줄간격
            });
        }

        // 5. 하단 배너 혹은 텍스트 슬로건 렌더링
        if (assets.bottomBanner && assets.bottomBanner.complete && assets.bottomBanner.naturalHeight > 0 && assets.bottomBanner.src) {
            ctx.drawImage(assets.bottomBanner, 0, drawnBottomBannerBaseY, CANVAS_W, bottomBannerHeight);
        } else {
            // 배너가 따로 없으면 요청하신 파란색 배경+흰색 텍스트의 슬로건 디자인을 렌더링합니다.
            bottomBannerHeight = 150;
            ctx.fillStyle = '#1e40af'; // blue-800(당 컬러 톤)과 유사한 색상
            ctx.fillRect(0, drawnBottomBannerBaseY, CANVAS_W, bottomBannerHeight);

            const sloganText = '생활정치 살림정치 생명정치';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const fontName = assets.fontReady ? 'CardFont' : 'sans-serif';
            ctx.font = `bold 52px "${fontName}"`;

            // 텍스트를 파란색 영역의 정중앙에 배치
            ctx.fillText(sloganText, CANVAS_W / 2, drawnBottomBannerBaseY + (bottomBannerHeight / 2));
        }
    }

    // 다운로드 처리 공통 로직
    const downloadAction = (e) => {
        e.preventDefault();
        try {
            const imgDataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `webcard_${new Date().getTime()}.png`;
            link.href = imgDataUrl;
            document.body.appendChild(link); // 브라우저 호환성을 위한 요소 추가
            link.click();
            document.body.removeChild(link); // 클릭 후 제거
        } catch (err) {
            console.error(err);
            alert("다운로드 실패: 로컬 파일(file://) 환경에서는 브라우저 보안 정책으로 이미지를 추출할 수 없습니다.\n\n해결 방법: VS Code의 'Live Server' 플러그인 등 로컬 웹 서버 환경에서 html을 실행해 주세요.");
        }
    };

    downloadBtn.addEventListener('click', downloadAction);

    const mobileDownloadBtn = document.getElementById('mobileDownloadBtn');
    if (mobileDownloadBtn) {
        mobileDownloadBtn.addEventListener('click', downloadAction);
    }
});
