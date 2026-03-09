document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('cardCanvas');
    const ctx = canvas.getContext('2d');

    // Inputs
    const imageUpload = document.getElementById('imageUpload');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const dateInput = document.getElementById('dateInput');
    const scheduleInput = document.getElementById('scheduleInput');
    const middleBannerUpload = document.getElementById('middleBannerUpload');
    const bottomBannerUpload = document.getElementById('bottomBannerUpload');
    const downloadBtn = document.getElementById('downloadBtn');

    // UI Elements for Dashboard
    const dashboardBtn = document.getElementById('dashboardBtn');
    const mobileDashboardBtn = document.getElementById('mobileDashboardBtn');
    const dashboardModal = document.getElementById('dashboardModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const historyListContainer = document.getElementById('historyListContainer');
    const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');

    // Storage Keys
    const AUTOSAVE_KEY = 'webcard_autosave';
    const HISTORY_KEY = 'webcard_history';

    // Assets
    const assets = {
        banner: new Image(),
        bottomBanner: new Image(),
        uploadedImg: null,
        uploadedMiddleBanner: null, // 커스텀 중단 배너용
        fontReady: false
    };

    // 로컬의 기본 배너/슬로건 이미지 로드
    assets.banner.src = 'banner.png';
    assets.bottomBanner.onerror = () => {
        assets.bottomBanner.onerror = null;
        assets.bottomBanner.src = '';
        drawCanvas();
    };
    assets.bottomBanner.src = 'bottom_banner.png';

    // 폰트 로딩 후 초기화/복구 진행
    document.fonts.load('10pt "CardFont"').then(() => {
        assets.fontReady = true;
        loadAutoSaveData(); // 폰트 로드 완료 후 자동저장된 데이터 복구 및 렌더링
    });

    // 캔버스 상수 및 이미지 조작 상태
    const CANVAS_W = 1080;

    // 높이 변수들 (상단 이미지 유무에 따라 유동적으로 변함)
    const MAX_IMAGE_H = 460;   // 상단 이미지가 있을 때의 높이
    const SECTION2_H = 200;    // 로고 배너 영역 높이

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
    setupDropZone('middleDropZone', middleBannerUpload, true);
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

            if (assets.uploadedImg !== null && pos.y <= MAX_IMAGE_H) {
                // 상단 영역 드롭
                imageUpload.files = droppedFiles;
                imageUpload.dispatchEvent(new Event('change'));
            } else if (pos.y > MAX_IMAGE_H && pos.y <= MAX_IMAGE_H + SECTION2_H) {
                // 중단 타이틀 배너 드롭
                middleBannerUpload.files = droppedFiles;
                middleBannerUpload.dispatchEvent(new Event('change'));
            } else {
                // 하단 배너 영역 드롭
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
                    if (removeImageBtn) removeImageBtn.classList.remove('hidden');
                    drawCanvasAndSave();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            assets.uploadedImg = null;
            if (removeImageBtn) removeImageBtn.classList.add('hidden');
            drawCanvasAndSave();
        }
    });

    // 메인 이미지 삭제(X) 버튼 로직
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // DropZone 이벤트 버블링 방지
            imageUpload.value = ''; // file 상태 초기화
            assets.uploadedImg = null;
            imgState.zoom = 1;
            imgState.panX = 0;
            imgState.panY = 0;
            removeImageBtn.classList.add('hidden');
            drawCanvasAndSave();
        });
    }

    // 중단 배너(커스텀) 업로드 / 삭제
    const removeMiddleBannerBtn = document.getElementById('removeMiddleBannerBtn');

    middleBannerUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    assets.uploadedMiddleBanner = img;
                    if (removeMiddleBannerBtn) removeMiddleBannerBtn.classList.remove('hidden');
                    drawCanvasAndSave();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            assets.uploadedMiddleBanner = null;
            if (removeMiddleBannerBtn) removeMiddleBannerBtn.classList.add('hidden');
            drawCanvasAndSave();
        }
    });

    if (removeMiddleBannerBtn) {
        removeMiddleBannerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            middleBannerUpload.value = '';
            assets.uploadedMiddleBanner = null;
            removeMiddleBannerBtn.classList.add('hidden');
            drawCanvasAndSave();
        });
    }

    // 하단 배너 업로드 / 삭제
    const removeBottomBannerBtn = document.getElementById('removeBottomBannerBtn');

    bottomBannerUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    assets.bottomBanner = img;
                    if (removeBottomBannerBtn) removeBottomBannerBtn.classList.remove('hidden');
                    drawCanvasAndSave();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            assets.bottomBanner = new Image(); // 기본상태
            assets.bottomBanner.src = 'bottom_banner.png'; // 기본 fallback용
            if (removeBottomBannerBtn) removeBottomBannerBtn.classList.add('hidden');
            drawCanvasAndSave();
        }
    });

    if (removeBottomBannerBtn) {
        removeBottomBannerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bottomBannerUpload.value = '';
            assets.bottomBanner = new Image();
            assets.bottomBanner.src = 'bottom_banner.png';
            removeBottomBannerBtn.classList.add('hidden');
            drawCanvasAndSave();
        });
    }

    // 텍스트 인풋 변경 이벤트
    [dateInput, scheduleInput].forEach(el => {
        el.addEventListener('input', drawCanvasAndSave);
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
        // 이미지가 그려진 상단 구역(0 ~ MAX_IMAGE_H)에서만 드래그 허용
        if (pos.y <= MAX_IMAGE_H) {
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

    // 모바일 터치 장치 지원 (Pinch-To-Zoom & Drag)
    let initialPinchDistance = null;
    let initialZoom = 1;

    function getPinchDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.addEventListener('touchstart', (e) => {
        if (!assets.uploadedImg) return;
        const pos = getMousePos(e.touches[0]);

        // 상단 사진 구역에서만 동작
        if (pos.y > MAX_IMAGE_H) return;

        if (e.touches.length === 2) {
            // 두 손가락일 땐 줌
            e.preventDefault();
            initialPinchDistance = getPinchDistance(e.touches);
            initialZoom = imgState.zoom;
            imgState.isDragging = false; // 드래그 중단
        } else if (e.touches.length === 1) {
            handleDragStart(e);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!assets.uploadedImg) return;

        if (e.touches.length === 2 && initialPinchDistance) {
            e.preventDefault();
            const currentDistance = getPinchDistance(e.touches);
            const zoomDelta = currentDistance / initialPinchDistance;

            let newZoom = initialZoom * zoomDelta;
            newZoom = Math.max(0.5, Math.min(newZoom, 3));
            imgState.zoom = newZoom;
            drawCanvas();
        } else if (e.touches.length === 1) {
            handleDragMove(e);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
        handleDragEnd();
    });

    // 마우스 휠 줌 기능
    canvas.addEventListener('wheel', (e) => {
        if (!assets.uploadedImg) return;
        const pos = getMousePos(e);

        // 상단 이미지 구역에서만 줌 동작 활성화
        if (pos.y <= MAX_IMAGE_H) {
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
            drawCanvasAndSave();
        }
    }, { passive: false });


    // ----- 캔버스 그리기 함수 -----
    function drawCanvas() {
        // 1. 레이아웃에 따른 동적 높이 및 Y 좌표 시작점 계산
        // 상단 이미지가 업로드 되었을 경우에만 높이를 가지도록 분기
        const hasTopImage = assets.uploadedImg !== null;
        let currentY = 0; // 요소를 그릴 때마다 내려가는 커서 역할

        let imageDrawHeight = 0;
        if (hasTopImage) {
            imageDrawHeight = MAX_IMAGE_H;
            currentY += MAX_IMAGE_H;
        }

        const bannerStartY = currentY; // 로고(배너)가 그려질 Y
        currentY += SECTION2_H; // 타이틀 배너 높이만큼 밑으로

        const scheduleText = scheduleInput.value || '';
        const lines = scheduleText ? scheduleText.split('\n') : [];

        // 일정 텍스트 영역 계산: 일정 시작 Y + 상단여백 80 + (줄 수 * 줄간격 80)
        let textEndY = currentY + 80 + (lines.length * 80);

        let bottomBannerHeight = 0;
        let drawnBottomBannerBaseY = textEndY + 40; // 텍스트에서 40px 여백 후 배너 시작

        if (assets.bottomBanner && assets.bottomBanner.complete && assets.bottomBanner.naturalHeight > 0) {
            // 커스텀 하단 배너
            const ratio = CANVAS_W / assets.bottomBanner.width;
            bottomBannerHeight = assets.bottomBanner.height * ratio;
        } else {
            // 기본 파란색 텍스트 슬로건 공간
            bottomBannerHeight = 150;
        }

        // 전체 캔버스 높이는 배너 끝 높이에 딱 맞춤 (최소 1400 등의 하드코딩 빈 공간 제거)
        const CANVAS_H = Math.round(drawnBottomBannerBaseY + bottomBannerHeight);
        canvas.height = CANVAS_H; // 동적 캔버스 리사이즈

        // 전체 배경 흰색 채우기
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 2. 상단 사진 그리기 (업로드 된 경우에만)
        if (hasTopImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, CANVAS_W, imageDrawHeight);
            ctx.clip();

            const img = assets.uploadedImg;

            // 이미지 전체를 감싸도록(cover) 스케일 계산
            const scale = Math.max(CANVAS_W / img.width, imageDrawHeight / img.height);
            const baseW = img.width * scale;
            const baseH = img.height * scale;

            // 줌 및 제한없는 패닝 적용
            const destW = baseW * imgState.zoom;
            const destH = baseH * imgState.zoom;

            const destX = (CANVAS_W - destW) / 2 + imgState.panX;
            const destY = (imageDrawHeight - destH) / 2 + imgState.panY;

            ctx.drawImage(img, destX, destY, destW, destH);

            ctx.restore();
        }

        // 3. 중단 배너 타이틀
        if (assets.uploadedMiddleBanner && assets.uploadedMiddleBanner.complete) {
            // 사용자의 커스텀 변경 중단 배너가 있을 경우 우선 렌더링
            ctx.drawImage(assets.uploadedMiddleBanner, 0, bannerStartY, CANVAS_W, SECTION2_H);
        } else if (assets.banner.complete && assets.banner.naturalHeight !== 0 && assets.banner.src) {
            // 기본 로고 배너
            ctx.drawImage(assets.banner, 0, bannerStartY, CANVAS_W, SECTION2_H);
        } else {
            // 배너 이미지 대체용 컬러 사각형
            ctx.fillStyle = '#0033A0';
            ctx.fillRect(0, bannerStartY, CANVAS_W, SECTION2_H);
        }

        // 날짜 텍스트 
        const dateText = dateInput.value || '';
        if (dateText) {
            const fontName = assets.fontReady ? 'CardFont' : 'sans-serif';
            ctx.fillStyle = '#FFFFFF';
            // 날짜 텍스트 사이즈 강제 고정
            ctx.font = `bold 60px "${fontName}"`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(dateText, 80, bannerStartY + (SECTION2_H / 2));
        }

        // 4. 하단 세부 일정 (배너 바로 밑부터 가변)
        if (lines.length > 0) {
            const fontName = assets.fontReady ? 'CardFont' : 'sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // bannerStartY + SECTION2_H 부터의 여백
            let scheduleY = bannerStartY + SECTION2_H + 80;

            lines.forEach((line) => {
                // 일정 텍스트 사이즈를 48px로 못박아 고정 (작아지는 문제 개선)
                ctx.font = `bold 48px "${fontName}"`;
                ctx.fillText(line, 80, scheduleY);
                scheduleY += 80; // 줄간격
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
        // ===== 자동 저장(Auto-save) 및 복구 =====

        // 그리기 발생 및 저장 (입력 이벤트 발생 등)
        function drawCanvasAndSave() {
            drawCanvas();
            saveAutoSaveData();
        }

        function saveAutoSaveData() {
            // 이미지는 dataURL로 변환하여 문자열로 저장
            const getBase64 = (img) => {
                if (!img || !img.src) return null;
                if (img.src.startsWith('data:')) return img.src; // 이미 Base64인 커스텀파일
                // 로컬 파일 등은 용량/보안 이슈로 저장 안 함 (수동 복구)
                return null;
            };

            const stateObj = {
                dateInput: dateInput.value,
                scheduleInput: scheduleInput.value,
                imgState: imgState,
                uploadedImgBase64: getBase64(assets.uploadedImg),
                uploadedMiddleBannerBase64: getBase64(assets.uploadedMiddleBanner),
                bottomBannerBase64: getBase64(assets.bottomBanner)
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateObj));
        }

        function loadAutoSaveData() {
            const savedData = localStorage.getItem(AUTOSAVE_KEY);
            if (savedData) {
                try {
                    const stateObj = JSON.parse(savedData);

                    dateInput.value = stateObj.dateInput || '';
                    scheduleInput.value = stateObj.scheduleInput || '';
                    if (stateObj.imgState) {
                        imgState = stateObj.imgState;
                    }

                    // 이미지 복구 함수 (비동기로 그려줌)
                    const restoreImg = (base64Str, assetKey, btnId) => {
                        if (base64Str) {
                            const img = new Image();
                            img.onload = () => {
                                assets[assetKey] = img;
                                const btn = document.getElementById(btnId);
                                if (btn) btn.classList.remove('hidden');
                                drawCanvas();
                            };
                            img.src = base64Str;
                        }
                    };

                    restoreImg(stateObj.uploadedImgBase64, 'uploadedImg', 'removeImageBtn');
                    restoreImg(stateObj.uploadedMiddleBannerBase64, 'uploadedMiddleBanner', 'removeMiddleBannerBtn');

                    if (stateObj.bottomBannerBase64 && assets.bottomBanner.src !== stateObj.bottomBannerBase64) {
                        restoreImg(stateObj.bottomBannerBase64, 'bottomBanner', 'removeBottomBannerBtn');
                    } else {
                        drawCanvas();
                    }

                } catch (e) { console.error("Auto-save load failed:", e); }
            } else {
                drawCanvas(); // 저장된 데이터가 없으면 그냥 초기 그리기
            }
        }

        // ===== 보관함(대시보드) 히스토리 기능 =====

        function saveToHistoryDashboard() {
            // 현재 상태를 히스토리용 오브젝트로 만들기
            const historyData = localStorage.getItem(HISTORY_KEY);
            let historyArray = historyData ? JSON.parse(historyData) : [];

            // 너무 크지 않도록 썸네일은 0.3 비율 등 해상도를 줄여 저장 가능하지만, 단순 구현을 위해 그대로 활용
            const stateObj = {
                id: new Date().getTime(),
                date: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR'),
                previewDataUrl: canvas.toDataURL('image/jpeg', 0.5), // 용량 절약을 위해 썸네일 JPEG 변환 
                autosaveState: localStorage.getItem(AUTOSAVE_KEY) // 복구 가능한 순수 상태 통째 저장
            };

            // 최신 내용이 0번 인덱스에 오도록 추가, 최대 15개 유지
            historyArray.unshift(stateObj);
            if (historyArray.length > 15) {
                historyArray.pop();
            }

            localStorage.setItem(HISTORY_KEY, JSON.stringify(historyArray));
        }

        function renderHistoryList() {
            historyListContainer.innerHTML = '';
            const historyData = localStorage.getItem(HISTORY_KEY);
            let historyArray = historyData ? JSON.parse(historyData) : [];

            if (historyArray.length === 0) {
                emptyHistoryMsg.classList.remove('hidden');
            } else {
                emptyHistoryMsg.classList.add('hidden');

                historyArray.forEach((item, index) => {
                    const card = document.createElement('div');
                    card.className = "bg-white border text-center border-gray-100 rounded-[1.5rem] shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col";

                    card.innerHTML = `
                    <div class="h-48 bg-gray-100 overflow-hidden flex justify-center items-center w-full">
                        <img src="${item.previewDataUrl}" class="h-full object-contain" alt="thumbnail">
                    </div>
                    <div class="p-4 flex-1 flex flex-col justify-between items-center text-center">
                        <p class="text-xs text-gray-400 mb-3">${item.date}</p>
                        <button class="w-full bg-[#f0f4f2] text-[#0f5c40] hover:bg-[#0f5c40] hover:text-white font-bold py-2.5 px-4 rounded-xl transition-colors text-sm" onclick="restoreHistoryItem(${index})">
                            이 작업 불러오기
                        </button>
                    </div>
                `;
                    historyListContainer.appendChild(card);
                });
            }
        }

        // 전역에서 접근 가능하도록 window 객체에 바인딩
        window.restoreHistoryItem = (index) => {
            const historyData = localStorage.getItem(HISTORY_KEY);
            let historyArray = historyData ? JSON.parse(historyData) : [];
            if (historyArray[index] && historyArray[index].autosaveState) {
                // localStorage의 오토세이브 키를 덮어씌움
                localStorage.setItem(AUTOSAVE_KEY, historyArray[index].autosaveState);
                // 덮어씌운 데이터를 기반으로 리로드 진행
                loadAutoSaveData();
                // 화면 닫기
                dashboardModal.classList.add('hidden');
            }
        };

        // 모달 토글 이벤트
        [dashboardBtn, mobileDashboardBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    renderHistoryList();
                    dashboardModal.classList.remove('hidden');
                });
            }
        });

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                dashboardModal.classList.add('hidden');
            });
        }

        // 다운로드 처리 및 히스토리 저장
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

                // 다운로드가 성공적으로 진행되었으면 히스토리(대시보드)에 등록
                saveAutoSaveData();
                saveToHistoryDashboard();

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
