# 测试 sqlsurge 命令可用性

## 步骤

1. **启动VS Code扩展开发环境**
   ```bash
   cd vsce
   code --extensionDevelopmentPath=. ../test_edit_sql_feature.py
   ```

2. **检查扩展是否已激活**
   - 打开VS Code开发者控制台 (Help > Toggle Developer Tools)
   - 查看Console标签页是否有扩展激活相关的日志

3. **测试命令可用性**
   - 按 `Cmd+Shift+P` 打开命令面板
   - 输入 "sqlsurge" 查看所有可用命令
   - 应该能看到以下命令：
     - `sqlsurge: Install sqls`
     - `sqlsurge: Restart SQL Language Server`
     - `sqlsurge: Format SQL`
     - `sqlsurge: Edit SQL in Temporary File` ← 新命令

4. **测试新命令功能**
   - 在 `test_edit_sql_feature.py` 中选中一个SQL字符串
   - 执行 "sqlsurge: Edit SQL in Temporary File" 命令
   - 检查是否打开了临时SQL文件

## 故障排除

如果命令不可用：
1. 检查扩展是否正确编译（无错误）
2. 重新加载VS Code窗口 (`Cmd+R`)
3. 检查开发者控制台是否有错误信息
4. 确认package.json中的命令定义正确
5. 确认extension.ts中的命令注册正确

## 当前状态
- ✅ 命令已在package.json中定义
- ✅ 命令已在extension.ts中注册
- ✅ 激活事件已添加到package.json
- ✅ 扩展已重新编译
- ⏳ 需要在VS Code中测试命令可用性