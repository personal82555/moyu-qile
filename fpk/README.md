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

## 分发渠道

### 1. FnDepot（社区第三方商店，已上架 ✅）
- 仓库：https://github.com/personal82555/FnDepot （GitHub Public，仓库名必须就叫 `FnDepot`）
- 用户在 FnDepot 客户端「添加源」输入该仓库地址即可看到并安装
- 规范要点：根目录 `fnpack.json`（V1 格式）+ `<appname>/ICON.PNG`（全大写）+ `<appname>.fpk`（与文件夹同名）+ 可选 `README.md`/`Preview/`
- 更新流程：换 `.fpk` → 改 `fnpack.json` 的 version/history → push，客户端同步时检测 version 变更
- 发布地址（给用户）：`https://github.com/personal82555/FnDepot`

### 2. 官方应用商店（流程中）
- 打包与真机测试已完成，待走 developer.fnnas.com / 开发者先锋交流群提交

### 3. 离线分发
- 直接把 `moyu-qile.fpk` 丢给对方：`appcenter-cli install-fpk moyu-qile.fpk`
