# <p align="center">External Player<p>

使用外部播放器播放网页中的视频

> 本仓库是 [LuckyPuppy514/external-player](https://github.com/LuckyPuppy514/external-player) 的个人 fork。
> 原作者署名、安装教程与 MIT 许可保持不变；本 fork 主要用于同步个人使用环境中的站点适配和 MPV 参数调整。

## 🔧 Fork 维护说明

本 fork 在原脚本基础上增加/调整了以下使用场景：

- MissAV：从页面中提取可播放 HLS 地址，直接交给 MPV 播放，并传入必要的 `origin` / `referer`。
- Pornhub：匹配视频页 / embed 页，交给 MPV 的 yt-dlp 流程处理；本地使用 `cookies.txt` 和浏览器 impersonation 以降低 410/403 概率。
- SpankBang：匹配视频页 / embed 页，交给 MPV 的 yt-dlp 流程处理；当前使用 `Safari-18.0` impersonation。该站点存在概率性 403，建议在 MPV 侧配合自动重试脚本使用。

Pornhub / SpankBang 这类站点依赖 yt-dlp extractor 和站点当前反爬策略，失败时优先尝试更新 yt-dlp、刷新本地 `cookies.txt`（如站点需要），或稍后重试。

### SpankBang

SpankBang 的 403 可能是概率性失败；本 fork 对 userscript 只负责传入更合适的 yt-dlp 参数，不在网页侧循环拉起多个 MPV。个人 mpv-lazy 配置中另配了 `portable_config/scripts/ytdl-retry.lua`，用于在 MPV 加载 URL 失败时自动重试同一 URL。

## 🧱 安装

### 1. 安装油猴插件

- [Tampermonkey](https://www.tampermonkey.net/index.php)

### 2. 安装油猴脚本

- [External Player](https://greasyfork.org/zh-CN/scripts/518677-external-player)

### 3. 安装 URL Scheme Handler

- [URL Scheme Handler](https://github.com/LuckyPuppy514/url-scheme-handler)

## 👀 支持的网站

- [yt-dlp 支持的网站](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- [B站](https://www.bilibili.com)
- [B站直播](https://live.bilibili.com)
- [樱花动漫](https://916dm.fans)
- [Girigiri爱动漫](https://anime.girigirilove.com) / [Girigiri爱动漫](https://anime.girigirilove.icu)
- [LIBVIO](https://www.libvio.app)
- [吐槽弹幕网](https://www.tucao.my)
- [萌番动漫馆](https://www.moepoi.net)
- [巴哈姆特](https://ani.gamer.com.tw)
- [CN影院](https://cnys.tv)
- [Anime1.me](https://anime1.me)
- [AGE动漫](https://rentry.org/agefans)
- Pronhub
- Missav
- SpankBang 

> 更多网站请自行探索，可以把网站正则添加到全局配置解析器中进行尝试

## 👏 相关仓库

- [Anime4K](https://github.com/bloc97/Anime4K)
- [mpv-player/mpv](https://github.com/mpv-player/mpv)
- [hooke007/MPV_lazy](https://github.com/hooke007/MPV_lazy)
- [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [LuckyPuppy514/Play-With-MPV](https://github.com/LuckyPuppy514/Play-With-MPV)
- [Telegram Web MPV Bridge](https://github.com/luoxue03/telegram-web-mpv-bridge)

## 😘 如何贡献

非常欢迎你的加入！[提一个 Issue](https://github.com/LuckyPuppy514/external-player/issues/new) 或者提交一个 Pull Request。
