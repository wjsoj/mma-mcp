# Docker Setup for Mathematica MCP Server

This MCP server requires **WolframScript** (part of Wolfram Engine) to execute Wolfram Language code.

## 关键问题：容器如何访问 WolframScript？

Wolfram Engine 是专有软件，通常安装在宿主机上。容器访问宿主机 WolframScript 有两种方案：

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Host 网络模式** | 最简单，无需配置路径 | 无网络隔离，端口可能冲突 | 开发环境、快速测试 |
| **Volume 挂载** | 网络隔离，更安全 | 需要知道 Wolfram 安装路径 | 生产环境 |

---

## 方案 1：Host 网络模式（推荐 - 最简单）

容器直接使用宿主机的网络栈，可以直接调用宿主机的 `wolframscript` 命令。

```bash
# 查找你的 wolframscript 路径
which wolframscript
# 典型输出: /usr/local/bin/wolframscript

# 运行容器（使用 host 网络）
docker run -d \
  --network host \
  -e MCP_TRANSPORT=http \
  -e MCP_HTTP_PORT=3000 \
  -e WOLFRAM_SCRIPT_PATH=$(which wolframscript) \
  mma-mcp:latest
```

**使用 docker-compose:**

```bash
docker-compose --profile mma-mcp-host up
```

---

## 方案 2：Volume 挂载（生产环境推荐）

将宿主机的 WolframScript 挂载到容器内。

### 首先找到 Wolfram 安装路径

```bash
# 查找 wolframscript 位置
which wolframscript

# 查找 Wolfram 安装目录
ls -la /usr/local/Wolfram*
ls -la /opt/Wolfram*
```

### 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  -v /usr/local/bin/wolframscript:/host/wolframscript:ro \
  -v ~/.WolframEngine:/home/mcpuser/.WolframEngine \
  -e WOLFRAM_SCRIPT_PATH=/host/wolframscript \
  mma-mcp:latest
```

**使用 docker-compose:**

```bash
# 编辑 .env 文件
echo "MCP_HTTP_PORT=3000" > .env

docker-compose --profile mma-mcp-mount up
```

---

## 常见 Wolfram 安装路径

| 系统 | 典型路径 |
|------|----------|
| Linux | `/usr/local/bin/wolframscript`, `/usr/local/Wolfram/*` |
| macOS | `/Applications/Wolfram Engine.app/Contents/MacOS/wolframscript` |
| WSL | `/mnt/c/Program Files/Wolfram Research/...` |

---

## Prerequisites

## Prerequisites

### 1. Wolfram Engine License

You need a valid Wolfram Engine license. Options:

- **Free license** for Raspberry Pi (limited to ARM)
- **Free license** for students with verified email
- **Commercial license** from Wolfram Research

Download from: https://www.wolfram.com/engine/

### 2. Docker Desktop

Install from: https://www.docker.com/products/docker-desktop/

## Quick Start

### Option 1: Using Custom Image with WolframScript

Build a custom image that includes WolframScript:

```bash
# Assuming you have the Wolfram Engine installer
docker build --build-arg WOLFRAM_INSTALLER_PATH=/path/to/WolframEngine.sh -t mma-mcp:latest .
```

### Option 2: Mount WolframScript from Host

If you have WolframScript installed on your host:

```bash
docker run -d \
  -p 3000:3000 \
  -v /usr/local/Wolfram:/usr/local/Wolfram:ro \
  -v /usr/local/bin/wolframscript:/usr/local/bin/wolframscript:ro \
  -v ~/.WolframEngine:/home/mcpuser/.WolframEngine \
  -e WOLFRAM_SCRIPT_PATH=/usr/local/bin/wolframscript \
  mma-mcp:latest
```

### Option 3: Using Docker Compose

1. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

2. Edit `.env` with your settings:

```env
MCP_TRANSPORT=http
MCP_HTTP_PORT=3000
MCP_API_KEY=your-secure-api-key-here
WOLFRAM_SCRIPT_PATH=/usr/local/bin/wolframscript
```

3. Build and run:

```bash
docker-compose up --build
```

## Building the Image

```bash
docker build -t mma-mcp:latest .
```

## Running the Container

### HTTP Transport (Default)

```bash
docker run -d \
  -p 3000:3000 \
  -e MCP_API_KEY=your-key-here \
  mma-mcp:latest
```

### Stdio Transport

For stdio mode, you typically use this as an MCP client tool:

```bash
docker run -i --rm \
  -e MCP_TRANSPORT=stdio \
  mma-mcp:latest
```

## Health Check

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "uptime": 1234,
  "components": {
    "wolframscript": "ok"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | Transport: `http` or `stdio` |
| `MCP_HTTP_PORT` | `3000` | HTTP port |
| `MCP_HTTP_HOST` | `0.0.0.0` | HTTP host (Docker default) |
| `MCP_API_KEY` | - | Optional Bearer token auth |
| `WOLFRAM_SCRIPT_PATH` | `wolframscript` | Path to executable |
| `DEFAULT_TIMEOUT` | `300` | Default timeout (seconds) |
| `MAX_TIMEOUT` | `86400` | Max timeout (seconds) |
| `LOG_LEVEL` | `info` | Logging level |

## Troubleshooting

### WolframScript Not Found

If you see "wolframscript not found", ensure:

1. WolframScript is installed in the container
2. `WOLFRAM_SCRIPT_PATH` is correctly set
3. Your Wolfram license is valid

### License Activation

For license activation inside the container, you may need to mount:

```bash
-v ~/.WolframEngine:/home/mcpuser/.WolframEngine
```

Or activate during build with an interactive session.

### Permission Issues

The container runs as user `mcpuser` (UID 1001). Ensure mounted volumes have correct permissions.

## Production Considerations

1. **Security**: Always use `MCP_API_KEY` in production
2. **Timeouts**: Adjust `DEFAULT_TIMEOUT` based on your workload
3. **Logging**: Set `LOG_LEVEL=warn` or `error` in production
4. **Health Checks**: Configure proper health check endpoints
5. **License**: Ensure your Wolfram license allows containerized deployments
