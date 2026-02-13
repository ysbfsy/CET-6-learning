# Firebase 配置指南

## 1. 创建 Firebase 项目

1. 打开 [Firebase Console](https://console.firebase.google.com)
2. 点击「添加项目」→ 输入项目名称 → 创建
3. 如需 Analytics 可启用，也可跳过

## 2. 添加 Web 应用

1. 在项目概览页点击「</>」Web 图标
2. 输入应用昵称（如 english-listening）
3. 复制生成的配置对象

## 3. 填写配置

打开 `js/firebase-config.js`，将复制的配置填入：

```javascript
const FirebaseConfig = {
    apiKey: "你的apiKey",
    authDomain: "你的项目.firebaseapp.com",
    projectId: "你的项目ID",
    storageBucket: "你的项目.appspot.com",
    messagingSenderId: "你的senderId",
    appId: "你的appId"
};
```

## 4. 启用 Authentication

1. 左侧菜单 → **Authentication** → 开始使用
2. 登录方法 → **电子邮件/密码** → 启用 → 保存

## 5. 创建 Firestore 数据库

1. 左侧菜单 → **Firestore Database** → 创建数据库
2. 选择「以测试模式启动」（开发用）
3. 选择区域（如 asia-east1）

## 6. 设置安全规则

1. Firestore → 规则
2. 将 `firestore.rules` 文件内容粘贴进去
3. 发布

规则确保用户只能读写自己的数据。

## 7. 完成

保存 `firebase-config.js` 后刷新网站，侧边栏会出现「登录/注册」按钮。
