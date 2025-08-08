# 如何使用 "Edit SQL in Temporary File" 功能

## 前提条件
1. 确保VS Code正在扩展开发模式下运行
2. 确保sqlsurge扩展已正确加载

## 使用步骤

### 方法1：通过命令面板
1. 打开包含SQL代码的Python文件（如 `test_edit_sql_feature.py`）
2. 选中一个SQL代码块（三引号字符串内的SQL内容）
3. 按 `Cmd+Shift+P` (macOS) 或 `Ctrl+Shift+P` (Windows/Linux) 打开命令面板
4. 输入 "sqlsurge" 查看所有可用命令
5. 选择 "sqlsurge: Edit SQL in Temporary File"

### 方法2：检查命令是否已注册
1. 在命令面板中输入 "Developer: Reload Window" 重新加载窗口
2. 或者按 `Cmd+R` (macOS) 重新加载扩展宿主窗口
3. 再次尝试查找命令

## 预期行为
- 选中SQL代码后执行命令，应该会：
  1. 在临时文件中打开选中的SQL内容
  2. 提供完整的SQL语法高亮和智能提示
  3. 编辑完成后可以应用更改回原文件

## 故障排除
如果找不到命令：
1. 检查VS Code开发者控制台是否有错误信息
2. 确认扩展是否正确编译（无TypeScript错误）
3. 重新加载扩展宿主窗口
4. 检查package.json中的命令定义是否正确

## 测试文件
使用 `test_edit_sql_feature.py` 文件进行测试：
- 选中第一个SQL查询（SELECT语句）
- 或选中第二个SQL查询（UPDATE语句）
- 执行命令测试功能