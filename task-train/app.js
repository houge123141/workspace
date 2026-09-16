// 狗不理の每日任务小火车 - 主逻辑
// ============================================

// 任务配置
const TASKS = [
    { id: 1, name: '校内数学作业', icon: '📐', color: '#FF6B35' },
    { id: 2, name: '校内语文作业', icon: '📝', color: '#4CAF50' },
    { id: 3, name: '语文阅读（绘本课堂）', icon: '📚', color: '#2196F3' },
    { id: 4, name: '阅读（自选或亲子）', icon: '📖', color: '#9C27B0' },
    { id: 5, name: '数学练习册', icon: '🔢', color: '#FF9800' },
    { id: 6, name: '语文听写', icon: '✍️', color: '#E91E63' },
    { id: 7, name: '英语（STORYFUN）', icon: '🔤', color: '#00BCD4' },
    { id: 8, name: '英语（语法朋友）', icon: '🗣️', color: '#607D8B' },
    { id: 9, name: '玩耍（自由活动或户外）', icon: '⚽', color: '#8BC34A' }
];

// 休息提醒间隔（毫秒）
const REST_INTERVAL = 30 * 60 * 1000; // 30分钟

// 状态
let tasks = [];
let currentTimer = null;
let currentTaskId = null;
let lastRestTime = Date.now();
let editingTaskId = null;
let editCount = {}; // 记录每个任务的修改次数

// 初始化
function init() {
    // 设置日期
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('currentDate').textContent = today.toLocaleDateString('zh-CN', options);

    // 加载保存的数据
    loadTasks();

    // 渲染任务列表
    renderTasks();

    // 设置休息提醒检查
    setInterval(checkRestTime, 10000); // 每10秒检查一次

    // 底部导航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.dataset.page).classList.add('active');
            
            if (item.dataset.page === 'statsPage') {
                drawPieChart();
            }
        });
    });

    // 添加任务按钮
    document.getElementById('addTaskBtn').addEventListener('click', addNewTask);

    // 点击遮罩关闭编辑弹窗
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });
}

// 加载任务数据
function loadTasks() {
    const saved = localStorage.getItem('taskTrain_' + getDateKey());
    if (saved) {
        tasks = JSON.parse(saved);
    } else {
        // 初始化任务
        tasks = TASKS.map(t => ({
            ...t,
            status: 'pending', // pending, running, paused, completed
            startTime: null,
            elapsedTime: 0,
            completedTime: null
        }));
    }
    
    // 加载编辑次数
    const savedEditCount = localStorage.getItem('taskTrain_editCount_' + getDateKey());
    if (savedEditCount) {
        editCount = JSON.parse(savedEditCount);
    }
}

// 保存任务数据
function saveTasks() {
    localStorage.setItem('taskTrain_' + getDateKey(), JSON.stringify(tasks));
    localStorage.setItem('taskTrain_editCount_' + getDateKey(), JSON.stringify(editCount));
}

// 获取日期key
function getDateKey() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
}

// 渲染任务列表
function renderTasks() {
    const container = document.getElementById('taskList');
    container.innerHTML = '';

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item ${task.status === 'running' ? 'active' : ''} ${task.status === 'completed' ? 'completed' : ''}`;
        
        const timeStr = formatTime(task.elapsedTime);
        
        let btnHtml = '';
        if (task.status === 'pending') {
            btnHtml = `<button class="task-btn btn-start" onclick="startTask(${task.id})">▶</button>`;
        } else if (task.status === 'running') {
            btnHtml = `<button class="task-btn btn-pause" onclick="pauseTask(${task.id})">⏸</button>`;
        } else if (task.status === 'paused') {
            btnHtml = `<button class="task-btn btn-start" onclick="resumeTask(${task.id})">▶</button>
                       <button class="task-btn btn-stop" onclick="stopTask(${task.id})" style="margin-left:8px;">⏹</button>`;
        } else if (task.status === 'completed') {
            btnHtml = `<button class="task-btn btn-done" onclick="editTask(${task.id})">✓</button>`;
        }

        div.innerHTML = `
            <div class="task-icon" style="background:${task.color}20;">${task.icon}</div>
            <div class="task-info">
                <div class="task-name">${task.name}</div>
                <div class="task-time">${task.status === 'completed' ? '已完成 ' + formatTime(task.completedTime) : (task.status === 'running' ? '进行中...' : '待开始')}</div>
            </div>
            <div class="task-timer">${timeStr}</div>
            ${btnHtml}
        `;
        
        container.appendChild(div);
    });

    // 更新统计
    updateStats();
}

// 格式化时间
function formatTime(ms) {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// 开始任务
function startTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // 暂停其他正在运行的任务
    tasks.forEach(t => {
        if (t.status === 'running' && t.id !== taskId) {
            pauseTask(t.id);
        }
    });

    task.status = 'running';
    task.startTime = Date.now() - task.elapsedTime;
    currentTaskId = taskId;

    // 开始计时
    startTimer();
    
    // 语音提醒
    speak(`开始${task.name}`);
    
    renderTasks();
    saveTasks();
}

// 暂停任务
function pauseTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'paused';
    task.elapsedTime = Date.now() - task.startTime;
    
    if (currentTaskId === taskId) {
        stopTimer();
        currentTaskId = null;
    }
    
    renderTasks();
    saveTasks();
}

// 恢复任务
function resumeTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'running';
    task.startTime = Date.now() - task.elapsedTime;
    currentTaskId = taskId;
    
    startTimer();
    renderTasks();
    saveTasks();
}

// 停止任务
function stopTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedTime = task.elapsedTime;
    
    if (currentTaskId === taskId) {
        stopTimer();
        currentTaskId = null;
    }
    
    speak(`${task.name}完成啦！`);
    showToast(`🎉 ${task.name} 已完成！`);
    
    renderTasks();
    saveTasks();
}

// 启动计时器
function startTimer() {
    stopTimer();
    currentTimer = setInterval(() => {
        const task = tasks.find(t => t.id === currentTaskId);
        if (task && task.status === 'running') {
            task.elapsedTime = Date.now() - task.startTime;
            updateTimerDisplay(task);
        }
    }, 100);
}

// 停止计时器
function stopTimer() {
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
    }
}

// 更新计时器显示
function updateTimerDisplay(task) {
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(item => {
        const name = item.querySelector('.task-name').textContent;
        if (name === task.name) {
            const timer = item.querySelector('.task-timer');
            if (timer) {
                timer.textContent = formatTime(task.elapsedTime);
            }
        }
    });
}

// 检查休息时间
function checkRestTime() {
    if (Date.now() - lastRestTime >= REST_INTERVAL) {
        // 检查是否有任务在运行
        const runningTask = tasks.find(t => t.status === 'running');
        if (runningTask) {
            document.getElementById('restAlert').classList.add('show');
            speak('该休息一下啦！已经连续学习30分钟了。');
        }
    }
}

// 继续学习
function continueWork() {
    document.getElementById('restAlert').classList.remove('show');
    lastRestTime = Date.now();
}

// 休息5分钟
function skipRest() {
    document.getElementById('restAlert').classList.remove('show');
    lastRestTime = Date.now() + 5 * 60 * 1000; // 5分钟后再提醒
    showToast('休息5分钟，计时暂停中...');
}

// 编辑任务
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // 检查是否已经修改过
    if (editCount[taskId]) {
        showToast('⚠️ 此任务只能修改一次，已经修改过了');
        return;
    }

    editingTaskId = taskId;
    document.getElementById('editTaskName').textContent = task.name;
    
    const completedMinutes = Math.floor(task.completedTime / 60000);
    const completedSeconds = Math.floor((task.completedTime % 60000) / 1000);
    document.getElementById('editMinutes').value = completedMinutes;
    document.getElementById('editSeconds').value = completedSeconds;
    
    document.getElementById('editModal').classList.add('show');
}

// 关闭编辑弹窗
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingTaskId = null;
}

// 保存编辑
function saveEdit() {
    if (!editingTaskId) return;

    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;

    const minutes = parseInt(document.getElementById('editMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('editSeconds').value) || 0;
    const newTime = (minutes * 60 + seconds) * 1000;

    task.completedTime = newTime;
    task.elapsedTime = newTime;
    
    // 记录修改次数
    editCount[editingTaskId] = true;
    
    closeEditModal();
    renderTasks();
    saveTasks();
    
    showToast('✅ 已保存（此任务不能再修改）');
}

// 添加新任务
function addNewTask() {
    const name = prompt('请输入任务名称：');
    if (!name) return;

    const newTask = {
        id: Date.now(),
        name: name,
        icon: '📌',
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        status: 'pending',
        startTime: null,
        elapsedTime: 0,
        completedTime: null
    };

    tasks.push(newTask);
    renderTasks();
    saveTasks();
    showToast('✅ 任务已添加');
}

// 更新统计
function updateStats() {
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const totalTimeMs = tasks.reduce((sum, t) => sum + (t.completedTime || t.elapsedTime || 0), 0);

    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('totalTime').textContent = formatTime(totalTimeMs);
}

// 语音提醒
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
}

// 显示提示框
function showToast(text) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// 绘制饼图
function drawPieChart() {
    const canvas = document.getElementById('pieChart');
    const ctx = canvas.getContext('2d');
    const legend = document.getElementById('chartLegend');
    
    // 清空
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    legend.innerHTML = '';

    // 获取已完成任务的数据
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedTime > 0);
    
    if (completedTasks.length === 0) {
        ctx.font = '14px PingFang SC';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('还没有完成的任务', canvas.width/2, canvas.height/2);
        return;
    }

    const total = completedTasks.reduce((sum, t) => sum + t.completedTime, 0);
    let startAngle = -Math.PI / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    completedTasks.forEach(task => {
        const sliceAngle = (task.completedTime / total) * 2 * Math.PI;
        
        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = task.color;
        ctx.fill();
        
        // 添加图例
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-color" style="background:${task.color};"></div>
            <div class="legend-text">${task.icon} ${task.name}</div>
            <div class="legend-value">${formatTime(task.completedTime)}</div>
        `;
        legend.appendChild(legendItem);
        
        startAngle += sliceAngle;
    });

    // 绘制中心圆（甜甜圈效果）
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    
    // 中心文字
    ctx.font = 'bold 16px PingFang SC';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('总计', centerX, centerY - 12);
    ctx.font = 'bold 20px PingFang SC';
    ctx.fillStyle = '#FF6B35';
    ctx.fillText(formatTime(total), centerX, centerY + 12);
}

// Service Worker 注册
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker 注册成功'))
        .catch(err => console.log('Service Worker 注册失败', err));
}

// 启动
document.addEventListener('DOMContentLoaded', init);
