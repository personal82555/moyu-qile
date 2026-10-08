# 飞牛应用商店打包（fpk）

打包工具：`fnpack`（官方，https://developer.fnnas.com/ 下载，本机已装）

```bash
cd fpk/moyu-qile
fnpack build .          # 生成 moyu-qile.fpk
appcenter-cli install-fpk moyu-qile.fpk   # NAS 本机测试安装
appcenter-cli status moyu-qile            # running / stopped
appcenter-cli uninstall moyu-qile         # 测试完卸载
```

结构：`manifest`（商店元数据）· `app/docker/docker-compose.yaml`（镜像/端口/数据卷）·
`app/ui/config`（桌面入口）· `cmd/`（生命周期脚本）· `ICON.PNG`/`ICON_256.PNG`（64/256 图标）。

已真机验证（fnOS）：安装 → running + HTTP 200 → 停/起 → 卸载，全流程通过。
提交上架：注册 https://developer.fnnas.com/ 开发者 → 「我的的应用」上传 .fpk + 图标 + 截图 + 更新说明。
