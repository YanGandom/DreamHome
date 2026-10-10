# 在手机上使用 DreamHome

DreamHome 是纯前端 Three.js 网站。部署到 Vercel 后，手机通过 HTTPS 网址访问，电脑不需要持续开机。无需数据库、环境变量或云端 Node 服务。

## GitHub → Vercel

1. 在 GitHub 创建独立的 `DreamHome` 仓库（可设为私有）。将本项目的内容上传到仓库根部：根部应直接看到 `index.html`、`package.json`、`build.mjs`、`vercel.json`、各 JS / CSS 文件和完整的 `vendor/` 文件夹。推荐将整个项目源码上传，排除 `.gitignore` 中的本地产物。
2. 在 Vercel 选择 **Add New → Project**，导入这个 GitHub 仓库，选定自己的团队。
3. **Framework Preset** 使用 **Other**。独立仓库的 **Root Directory** 使用仓库根目录；若仓库里保留了 `DreamHome/` 这一层，则选择 `DreamHome`。
4. 配置文件会指定 **Build Command = `node build.mjs`**、**Output Directory = `dist`**，并跳过安装依赖。保留这些配置；无须填环境变量，也不要将 `node server.cjs` 用作构建命令。
5. 点击 **Deploy**，完成后在手机 Safari / Chrome 中打开 Vercel 提供的 HTTPS 地址。可在 Vercel 项目的 Domains 设置中绑定自己的域名。
6. 之后把修改推送到 Vercel 关联的生产分支，会触发自动部署；其它分支可用于预览测试。

当前 DreamHome 文件夹位于 BlenderTest 的 Git 仓库范围内。本次没有创建新远程仓库或推送代码。只上传 DreamHome 项目，不要把 BlenderTest 里的表格、模型等其它任务混入这个仓库。

## 本地构建

在本目录运行 `npm run build` 或 `node build.mjs`。构建会重新生成 `dist/`，只包含运行网站需要的 HTML、CSS 和 JS，包含本地 Three.js；不会把测试工具、参考图片和说明文档发布到网站。

`server.cjs` 仍用于电脑本地开发，监听 `127.0.0.1:4173`。手机中的 `127.0.0.1` 指向手机自己，不能用这个地址打开电脑上的场景；部署后使用网站地址。

## 手机使用与存档

已有响应式布局、安全区留白和触屏指针操作。横向滑动底部组件库浏览模型，向上拖入场景摆放；轻点选择，拖动环绕，双指缩放。手机横屏有更大的场景操作区域。

场景要求 WebGL 2。先用系统 Safari 或 Chrome 检查加载、选中、移动、旋转、改色、楼层切换和截图保存。当前 3D 场景仍需手机真机性能测试，网站部署不代表所有手机都能流畅运行。

布局使用当前浏览器、当前网站来源的 localStorage。电脑和手机、不同域名、预览网址和正式网址之间不自动同步；原 localhost 布局也不会自动迁到新网站。需要跨设备继续编辑时，后续可加布局文件导入导出，或账号与云端存档。

浏览器可将网址添加到主屏幕作为快捷入口。当前版本未添加完整的 PWA 安装与离线支持；如需要独立窗口、应用图标和离线启动，可后续补充。
