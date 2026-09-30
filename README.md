# 临时图片下载测试

此目录仅用于 GitHub Pages 网络下载测试，不是 NASA 正式内容目录。
三张图片是本地原创的确定性几何图案，按 CC0-1.0 发布；未使用 NASA、用户图片或第三方素材。
manifest.json 记录每张图的实际格式、尺寸、文件字节数和 SHA-256。
可比较 Wi-Fi、移动网络下的下载耗时、成功率和下载后 SHA-256。

重新生成：在项目根目录执行 node backend/github-pages-test/build-fixtures.cjs。
生成过程只读取本地 sharp 模块，不联网。
