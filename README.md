# 英语听力学习系统

一个帮助提升英语听力的网页应用，支持文章管理、单词标记、六级听力测验和学习计划追踪。

## 功能特性

### 1. 文章库
- **上传文件**：支持 .txt、.md 格式，可拖拽或点击上传
- **粘贴文本**：直接粘贴或输入英语文章
- **管理文章**：查看、阅读、删除已保存文章

### 2. 单词标记
阅读文章时，点击任意单词可循环切换四种标记状态：
- **新单词**：需要学习的新词汇
- **听不出来**：听力中难以辨别的词
- **需要重复**：需要反复练习的词
- 再次点击可清除标记

### 3. 六级听力测验
- 选择文章自动生成听力理解题
- 题型包括：主旨题、细节题、词汇填空题
- 即时反馈正误

### 4. 学习计划
- 添加学习任务，设置计划日期
- 可将任务关联到具体文章
- 完成任务打卡，记录学习天数
- 学习日历展示近期学习记录
- 连续学习天数统计

## 使用方法

1. 用浏览器打开 `index.html` 即可使用
2. 所有数据保存在本地（LocalStorage），无需服务器
3. 建议使用 Chrome、Edge、Firefox 等现代浏览器

## 部署到 GitHub Pages

### 1. 创建仓库并上传

```bash
# 在项目目录下执行
git init
git add .
git commit -m "初始提交"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 2. 开启 GitHub Pages

1. 打开仓库 → **Settings** → **Pages**
2. **Source** 选择 **Deploy from a branch**
3. **Branch** 选择 `main`，文件夹选 `/ (root)`
4. 点击 **Save**

### 3. 访问网站

几分钟后，网站地址为：
- `https://你的用户名.github.io/仓库名/`

例如仓库名为 `english-listening`，则地址为：`https://xxx.github.io/english-listening/`

### 4. 绑定自定义域名（可选）

1. 在 Pages 设置中填写你的域名（如 `www.example.com`）
2. 在域名服务商添加 **CNAME** 记录，指向 `你的用户名.github.io`

## 项目结构

```
英语听力网站/
├── index.html      # 主页面
├── css/
│   └── style.css   # 样式
├── js/
│   ├── storage.js  # 本地存储
│   ├── articles.js # 文章与单词标记
│   ├── quiz.js     # 测验生成
│   ├── plan.js     # 学习计划
│   └── app.js      # 主逻辑
└── README.md
```

## 技术说明

- 纯前端实现，无后端依赖
- 数据存储在浏览器 LocalStorage
- 适配桌面端与移动端显示
