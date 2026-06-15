// ==UserScript==
// @name              教师研修网自动看课脚本
// @name:zh-CN        教师研修网自动看课脚本
// @namespace         https://github.com/AGkite/yanxiu
// @version           2.7.0
// @description       Auto study on yanxiu.com: course pick, speed play, quiz, PPT/doc, next lesson.
// @description:zh-CN yanxiu.com 自动选课、倍速播放、PPT课件翻页、自动答题、自动切下一节
// @author            AGkite
// @match             https://*.yanxiu.com/*
// @icon              https://www.google.com/s2/favicons?sz=64&domain=yanxiu.com
// @grant             none
// @run-at            document-idle
// @license           MIT
// @charset           UTF-8
// @homepageURL       https://github.com/AGkite/yanxiu
// @supportURL        https://github.com/AGkite/yanxiu/issues
// @downloadURL       https://raw.githubusercontent.com/AGkite/yanxiu/main/yanxiu.user.js
// @updateURL         https://raw.githubusercontent.com/AGkite/yanxiu/main/yanxiu.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[研修网刷课]';
    // 倍速设置：建议 1~2，过高可能导致学时不记录或被检测
    const PLAYBACK_RATE = 2;
    // 学习锁：视频页存活期间保持，仅课程结束或超时后释放（不依赖心跳，避免后台 tab 被节流误判）
    const STORAGE_PLAYER_LOCK = 'yx-player-lock';
    const STORAGE_PLAYER_HEARTBEAT = 'yx-player-heartbeat';
    const STORAGE_PLAYER_TAB = 'yx-player-tab-id';
    const STORAGE_PLAYER_URL = 'yx-player-url';
    // 心跳超过此时间未更新，视为视频页已关闭（后台 tab 约每 15~60 秒刷新一次）
    const HEARTBEAT_ACTIVE = 2 * 60 * 1000;
    // PPT/文档每页停留秒数（会随 PLAYBACK_RATE 缩短）
    const DOC_PAGE_SECONDS = 6;
    const DOC_CATALOG_SECONDS = 40;
    const TAB_ID = sessionStorage.getItem('yx-tab-id') || ('tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
    sessionStorage.setItem('yx-tab-id', TAB_ID);
    let statusText = '脚本已加载';
    let lastListClickAt = 0;
    let lastNextClickAt = 0;
    let lastDocPageAt = 0;
    let lastDocPageKey = '';
    let lastCatalogAdvanceAt = 0;
    let listClickLocked = false;

    function log(msg) {
        console.log(`${LOG} ${msg}`);
        statusText = msg;
        updatePanel();
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isVisible(element) {
        if (!(element instanceof Element) || !document.body.contains(element)) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function clickElement(el) {
        if (!el || !isVisible(el)) {
            return false;
        }
        el.click();
        return true;
    }

    function getHeartbeatAge() {
        const beat = localStorage.getItem(STORAGE_PLAYER_HEARTBEAT);
        if (!beat) {
            return Infinity;
        }
        return Date.now() - parseInt(beat, 10);
    }

    function setPlayerLock() {
        localStorage.setItem(STORAGE_PLAYER_LOCK, '1');
        localStorage.setItem(STORAGE_PLAYER_HEARTBEAT, String(Date.now()));
    }

    function releasePlayerLock() {
        localStorage.removeItem(STORAGE_PLAYER_LOCK);
        localStorage.removeItem(STORAGE_PLAYER_HEARTBEAT);
        localStorage.removeItem(STORAGE_PLAYER_TAB);
        localStorage.removeItem(STORAGE_PLAYER_URL);
    }

    function isPlayerTabOpen() {
        if (localStorage.getItem(STORAGE_PLAYER_LOCK) !== '1') {
            return false;
        }
        if (getHeartbeatAge() > HEARTBEAT_ACTIVE) {
            releasePlayerLock();
            return false;
        }
        return true;
    }

    // 列表页启动时清理残留锁（例如手动关闭了视频 tab）
    function cleanupStaleLock() {
        if (localStorage.getItem(STORAGE_PLAYER_LOCK) !== '1') {
            return;
        }
        if (getHeartbeatAge() > HEARTBEAT_ACTIVE) {
            releasePlayerLock();
            log('视频页已关闭，准备继续下一课程');
        }
    }

    function bindPlayerTabUnload() {
        window.addEventListener('pagehide', () => {
            if (localStorage.getItem(STORAGE_PLAYER_TAB) === TAB_ID) {
                releasePlayerLock();
            }
        });
    }

    function touchPlayerHeartbeat() {
        const pageType = getPageType();
        if (pageType !== 'legacy-player' && pageType !== 'train2-player') {
            return;
        }
        localStorage.setItem(STORAGE_PLAYER_LOCK, '1');
        localStorage.setItem(STORAGE_PLAYER_HEARTBEAT, String(Date.now()));
        localStorage.setItem(STORAGE_PLAYER_TAB, TAB_ID);
        localStorage.setItem(STORAGE_PLAYER_URL, location.href.split('#')[0]);
    }

    function clearPlayerTabOpen() {
        if (localStorage.getItem(STORAGE_PLAYER_TAB) === TAB_ID) {
            releasePlayerLock();
        }
    }

    function forceReleaseIfPlayerPage() {
        const pageType = getPageType();
        if (pageType === 'legacy-player' || pageType === 'train2-player') {
            releasePlayerLock();
        }
    }

    function getPageType() {
        const path = location.pathname;
        if (path.includes('/train2/') && path.includes('/training/member')) {
            return 'train2-list';
        }
        if (path.includes('/train2/')) {
            return 'train2-player';
        }
        if (path === '/train/guide/course/list') {
            return 'legacy-list';
        }
        if (/\/grain\/course\/\d+\/detail/.test(path)) {
            return 'legacy-player';
        }
        if (path.includes('/cms/project/index')) {
            return 'project-index';
        }
        return 'unknown';
    }

    function findByExactText(text, root) {
        root = root || document;
        return [...root.querySelectorAll('button, a, span, div, p, li')].filter((el) => {
            return el.textContent.trim() === text && isVisible(el);
        });
    }

    function findByContainsText(text, root) {
        root = root || document;
        return [...root.querySelectorAll('button, a, span, div, p, li')].filter((el) => {
            return el.textContent.includes(text) && isVisible(el);
        });
    }

    function updatePanel() {
        let panel = document.getElementById('yx-auto-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'yx-auto-panel';
            panel.style.cssText = [
                'position:fixed',
                'top:10px',
                'right:10px',
                'z-index:999999',
                'background:rgba(0,0,0,0.75)',
                'color:#0f0',
                'padding:8px 12px',
                'border-radius:6px',
                'font-size:13px',
                'max-width:320px',
                'line-height:1.5',
                'pointer-events:none'
            ].join(';');
            document.body.appendChild(panel);
        }
        panel.textContent = `${LOG} ${statusText}`;
    }

    function hasActiveVideo() {
        for (const video of document.querySelectorAll('video')) {
            if (!isVisible(video)) {
                continue;
            }
            if (video.duration && !isNaN(video.duration) && video.duration > 0) {
                return true;
            }
        }
        for (const frame of document.querySelectorAll('iframe')) {
            try {
                const doc = frame.contentDocument;
                if (!doc) {
                    continue;
                }
                for (const video of doc.querySelectorAll('video')) {
                    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
                        return true;
                    }
                }
            } catch (e) {
                // 跨域 iframe 忽略
            }
        }
        return false;
    }

    function getDocumentPageInfo() {
        const candidates = [...document.querySelectorAll('span, div, p, em, b')].filter(isVisible);
        for (const el of candidates) {
            const text = el.textContent.trim();
            const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
            if (match) {
                const current = parseInt(match[1], 10);
                const total = parseInt(match[2], 10);
                if (total > 0 && current > 0 && current <= total) {
                    return { current: current, total: total, el: el };
                }
            }
        }
        return null;
    }

    function clickDocumentNextPage() {
        const textBtns = ['下一页', '下一张', '下一章'];
        for (const text of textBtns) {
            const btn = findByExactText(text).find((el) => !el.closest('.ended-mask, .catalogue-list, .catalog-list'));
            if (btn && clickElement(btn)) {
                return true;
            }
        }

        const iconSelectors = [
            '.ivu-icon-ios-arrow-forward',
            '.ivu-icon-arrow-right-b',
            '[class*="arrow-forward"]',
            '[class*="arrow-right"]',
            '[class*="icon-next"]',
            '[class*="page-next"]',
            '[class*="PageNext"]'
        ];
        for (const sel of iconSelectors) {
            const icons = [...document.querySelectorAll(sel)].filter(isVisible);
            for (const icon of icons) {
                const target = icon.closest('button, a, span, div') || icon;
                if (clickElement(target)) {
                    return true;
                }
            }
        }

        const pageInfo = getDocumentPageInfo();
        if (pageInfo && pageInfo.el.parentElement) {
            const siblings = [...pageInfo.el.parentElement.children].filter(isVisible);
            const idx = siblings.indexOf(pageInfo.el);
            if (idx >= 0) {
                for (let i = idx + 1; i < siblings.length; i++) {
                    const target = siblings[i].querySelector('i, button, span, a') || siblings[i];
                    if (clickElement(target)) {
                        return true;
                    }
                }
            }
        }

        document.documentElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true
        }));
        return true;
    }

    function finishCurrentCourse() {
        if (location.pathname.includes('/train2/')) {
            log('本节已学完，返回课程列表');
            forceReleaseIfPlayerPage();
            const memberUrl = location.href.replace(/\/training\/[^/?#]+.*$/, '/training/member');
            if (memberUrl !== location.href) {
                setTimeout(() => { location.href = memberUrl; }, 2000);
            }
            return;
        }
        log('本节已学完，关闭页面返回列表');
        forceReleaseIfPlayerPage();
        setTimeout(() => {
            if (window.opener) {
                window.close();
            } else {
                history.back();
            }
        }, 2000);
    }

    function handleDocumentPlayer() {
        const pageInfo = getDocumentPageInfo();
        const pageInterval = Math.max(3000, (DOC_PAGE_SECONDS * 1000) / PLAYBACK_RATE);
        const catalogInterval = Math.max(15000, (DOC_CATALOG_SECONDS * 1000) / PLAYBACK_RATE);
        const now = Date.now();

        if (pageInfo) {
            const pageKey = pageInfo.current + '/' + pageInfo.total;
            if (pageInfo.current < pageInfo.total) {
                if (lastDocPageKey !== pageKey) {
                    lastDocPageKey = pageKey;
                    lastDocPageAt = now;
                    log(`PPT 阅读中 ${pageInfo.current}/${pageInfo.total}`);
                    return;
                }
                if (now - lastDocPageAt >= pageInterval) {
                    clickDocumentNextPage();
                    lastDocPageAt = now;
                    log(`PPT 翻页 ${pageInfo.current}/${pageInfo.total}`);
                }
                return;
            }

            log(`PPT 已到最后一页 ${pageInfo.current}/${pageInfo.total}`);
            if (now - lastNextClickAt >= 5000) {
                if (!tryGoNextVideo()) {
                    finishCurrentCourse();
                }
            }
            return;
        }

        if (now - lastCatalogAdvanceAt >= catalogInterval) {
            if (clickNextCatalogItem()) {
                lastCatalogAdvanceAt = now;
                lastDocPageKey = '';
                return;
            }
            if (now - lastNextClickAt >= 5000 && tryGoNextVideo()) {
                lastCatalogAdvanceAt = now;
                return;
            }
        }

        log('课件学习中…');
    }

    function applyPlaybackRate(video) {
        video.muted = true;
        if (video.playbackRate !== PLAYBACK_RATE) {
            video.playbackRate = PLAYBACK_RATE;
        }
        if (video.paused && !video.ended) {
            video.play().catch(() => {});
        }
    }

    function handleCommonPopups() {
        const alarmSelectors = [
            '.alarmClock-wrapper',
            '.clock-tip',
            '[class*="alarmClock"]',
            '[class*="AlarmClock"]'
        ];
        for (const sel of alarmSelectors) {
            const el = document.querySelector(sel);
            if (el && isVisible(el)) {
                clickElement(el);
                log('已点击继续计时');
                return true;
            }
        }
        findByContainsText('点击我继续').forEach((el) => {
            if (!el.closest('.question-stem')) {
                clickElement(el);
            }
        });

        const scoring = document.querySelector('.scoring-wrapper');
        if (scoring && isVisible(scoring)) {
            const rateBtn = document.querySelector('div.commit > button.ivu-btn');
            if (rateBtn) {
                rateBtn.disabled = false;
                clickElement(rateBtn);
                log('已提交课程评分');
            }
        }

        handleQuiz();

        const textBtns = document.querySelectorAll('button.ivu-btn.ivu-btn-text');
        if (textBtns.length === 2 && isVisible(textBtns[1])) {
            clickElement(textBtns[1]);
        }
        return false;
    }

    function clickNextCatalogItem() {
        const selectors = [
            '.catalogue-list li',
            '.catalog-list li',
            '.menu-list li',
            '[class*="catalog"] li',
            '[class*="Catalog"] li',
            '.ivu-tree-title'
        ];
        let items = [];
        for (const sel of selectors) {
            const found = [...document.querySelectorAll(sel)].filter(isVisible);
            if (found.length > 1) {
                items = found;
                break;
            }
        }
        if (items.length === 0) {
            return false;
        }

        let activeIndex = -1;
        items.forEach((item, index) => {
            const cls = item.className || '';
            const style = window.getComputedStyle(item);
            if (
                cls.includes('active') ||
                cls.includes('current') ||
                cls.includes('selected') ||
                item.querySelector('.active, .current, .selected') ||
                style.color === 'rgb(24, 144, 255)' ||
                style.fontWeight === '600' ||
                style.fontWeight === '700'
            ) {
                activeIndex = index;
            }
        });

        const start = activeIndex >= 0 ? activeIndex + 1 : 0;
        for (let i = start; i < items.length; i++) {
            const target = items[i].querySelector('a, span, div, p') || items[i];
            if (clickElement(target)) {
                log(`已切换目录第 ${i + 1} 节`);
                return true;
            }
        }
        return false;
    }

    function tryGoNextVideo() {
        const now = Date.now();
        if (now - lastNextClickAt < 5000) {
            return false;
        }

        const nextBtn =
            document.querySelector('p.next') ||
            document.querySelector('.ended-mask .next') ||
            findByExactText('下一个')[0] ||
            findByExactText('下一节')[0] ||
            findByContainsText('下一个')[0];

        if (nextBtn && isVisible(nextBtn)) {
            clickElement(nextBtn);
            lastNextClickAt = now;
            log('当前视频已学完，点击下一节');
            return true;
        }

        if (clickNextCatalogItem()) {
            lastNextClickAt = now;
            return true;
        }

        return false;
    }

    function handleQuiz() {
        document.querySelectorAll('.question-stem').forEach((item, index) => {
            if (!isVisible(item)) {
                return;
            }
            const label = item.querySelector('.label-text');
            if (label) {
                clickElement(label);
            }
            setTimeout(() => {
                const btns = document.querySelectorAll('.question button.ivu-btn.ivu-btn-primary');
                if (btns[index]) {
                    clickElement(btns[index]);
                }
            }, 1500);
        });

        document.querySelectorAll('.ivu-modal-wrap:not([style*="display: none"]) .ivu-radio-wrapper').forEach((radio) => {
            if (isVisible(radio)) {
                clickElement(radio);
            }
        });
        document.querySelectorAll('.ivu-modal-wrap:not([style*="display: none"]) .ivu-btn-primary').forEach((btn) => {
            if (isVisible(btn) && btn.textContent.includes('确定')) {
                clickElement(btn);
            }
        });
    }

    function expandModules() {
        document.querySelectorAll('.ivu-collapse-header, [class*="collapse"] [class*="header"]').forEach((header) => {
            const item = header.closest('.ivu-collapse-item, [class*="collapse-item"]');
            if (item && !item.classList.contains('ivu-collapse-item-active')) {
                clickElement(header);
            }
        });
    }

    function findNextIncompleteLesson() {
        const watchTexts = ['继续看课', '开始看课', '看课'];
        const candidates = [...document.querySelectorAll('button, a')].filter((el) => {
            const text = el.textContent.trim();
            return watchTexts.includes(text) && isVisible(el);
        });
        const buttons = candidates.filter((el) => {
            return !candidates.some((other) => other !== el && other.contains(el));
        });

        for (const btn of buttons) {
            let container = btn.parentElement;
            for (let depth = 0; depth < 12 && container; depth++) {
                const match = container.textContent.match(/已观看\s*(\d+)%/);
                if (match) {
                    const percent = parseInt(match[1], 10);
                    if (percent < 100) {
                        return { button: btn, percent: percent };
                    }
                    break;
                }
                container = container.parentElement;
            }
        }

        if (buttons.length > 0) {
            return { button: buttons[0], percent: 0 };
        }
        return null;
    }

    function handleCourseList() {
        expandModules();

        const hasVideo = document.querySelector('video');
        if (hasVideo && isVisible(hasVideo)) {
            return;
        }

        if (isPlayerTabOpen()) {
            log('已有学习页在进行，等待完成');
            return;
        }

        if (listClickLocked) {
            return;
        }

        const lesson = findNextIncompleteLesson();
        if (!lesson) {
            log('未找到未完成课程，请确认在「课程学习」页面');
            return;
        }

        const now = Date.now();
        if (now - lastListClickAt < 60000) {
            return;
        }

        listClickLocked = true;
        if (clickElement(lesson.button)) {
            lastListClickAt = now;
            setPlayerLock();
            localStorage.setItem(STORAGE_PLAYER_TAB, 'list-pending');
            log(`已点击继续看课（进度 ${lesson.percent}%）`);
        }
        setTimeout(() => {
            listClickLocked = false;
        }, 3000);
    }

    function handleVideoPlayer() {
        touchPlayerHeartbeat();

        if (handleCommonPopups()) {
            return;
        }

        if (!hasActiveVideo()) {
            handleDocumentPlayer();
            return;
        }

        let anyEnded = false;

        document.querySelectorAll('video').forEach((video) => {
            applyPlaybackRate(video);
            if (video.ended) {
                anyEnded = true;
            }
        });

        document.querySelectorAll('iframe').forEach((frame) => {
            try {
                const doc = frame.contentDocument;
                if (!doc) {
                    return;
                }
                doc.querySelectorAll('video').forEach((video) => {
                    applyPlaybackRate(video);
                    if (video.ended) {
                        anyEnded = true;
                    }
                });
            } catch (e) {
                // 跨域 iframe 忽略
            }
        });

        const endedMask = document.querySelector('.ended-mask');
        if ((endedMask && isVisible(endedMask)) || anyEnded) {
            if (!tryGoNextVideo()) {
                finishCurrentCourse();
            }
        }
    }

    async function handleLegacyCourseList() {
        await sleep(500);

        function getGoal() {
            const ems = document.querySelectorAll('em');
            if (ems.length >= 2) {
                const total = parseInt(ems[0].innerText.match(/\d+(?=分钟)/));
                const done = parseInt(ems[1].innerText.match(/\d+(?=分钟)/)[0]);
                return total - done;
            }
            return 300;
        }

        function getProgress(item) {
            const info = item.firstElementChild.lastElementChild;
            if (info.className === 'item-infos pass') {
                return 1;
            }
            if (info.lastElementChild.childElementCount === 1) {
                return 0;
            }
            return 0.01 * parseInt(info.lastElementChild.lastElementChild.innerText.match(/\d+(?=%)/)[0]);
        }

        const minutesTotal = getGoal();
        const filterBtn = document.querySelector('ul.filter-data > li:nth-child(3) > div > div.content > div:nth-child(3) > span');
        if (filterBtn) {
            clickElement(filterBtn);
        }
        await sleep(500);

        if (document.querySelectorAll('div.item').length === 0) {
            const allBtn = document.querySelector('ul.filter-data > li:nth-child(3) > div > div.content > div:nth-child(1) > span');
            if (allBtn) {
                clickElement(allBtn);
            }
        }
        await sleep(500);

        const courses = document.querySelectorAll('div.item');
        if (minutesTotal <= 0) {
            log('已完成所需学时');
            return;
        }

        if (isPlayerTabOpen()) {
            log('已有学习页在进行，等待完成');
            return;
        }

        for (let i = 0; i < courses.length; i++) {
            const progress = getProgress(courses[i]);
            if (progress >= 1) {
                continue;
            }
            const link = courses[i].firstChild.firstChild;
            if (link) {
                clickElement(link);
                setPlayerLock();
                localStorage.setItem(STORAGE_PLAYER_TAB, 'list-pending');
                log(`已打开第 ${i + 1} 个课程`);
            }
            break;
        }
    }

    function start() {
        updatePanel();
        const pageType = getPageType();
        log(`检测到页面类型: ${pageType}`);

        if (pageType === 'train2-list' || pageType === 'project-index') {
            cleanupStaleLock();
            setTimeout(handleCourseList, 3000);
            setInterval(handleCourseList, 10000);
            setInterval(handleVideoPlayer, 3000);
            setInterval(handleQuiz, 5000);
        } else if (pageType === 'legacy-list') {
            cleanupStaleLock();
            handleLegacyCourseList();
        } else if (pageType === 'train2-player' || pageType === 'legacy-player') {
            bindPlayerTabUnload();
            touchPlayerHeartbeat();
            document.addEventListener('visibilitychange', () => {
                touchPlayerHeartbeat();
            });
            // 独立心跳，避免 handleVideoPlayer 在后台 tab 被节流后列表页误判
            setInterval(() => {
                touchPlayerHeartbeat();
            }, 10000);
            handleVideoPlayer();
            setInterval(handleVideoPlayer, 3000);
            setInterval(handleQuiz, 5000);
        } else {
            cleanupStaleLock();
            setTimeout(() => {
                handleCourseList();
                handleVideoPlayer();
            }, 3000);
            setInterval(handleCourseList, 10000);
            setInterval(handleVideoPlayer, 3000);
            setInterval(handleQuiz, 5000);
        }
    }

    start();
})();
