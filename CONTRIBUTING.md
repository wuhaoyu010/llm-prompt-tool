# 贡献指南

感谢您考虑为本项目做出贡献！

## 开发环境设置

### 后端

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 前端

```bash
cd src/frontend
npm install
```

## 运行测试

```bash
pytest tests/
```

## 代码风格

- Python: 遵循 PEP 8 规范
- TypeScript/Vue: 遵循项目现有风格

## 提交规范

请遵循 Conventional Commits 格式：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

## Pull Request 流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request