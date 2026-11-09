# AI Buddy Voice 1.0.1

面向 Windows x64、AI Buddy ^2.0.9 的语音插件源码。两个可选引擎共用一个内部运行组件：`ai-buddy.voice-breeze`、`ai-buddy.voice-gpt-sovits` 和 `ai-buddy.voice-shared-runtime`。引擎精确依赖共享组件 1.0.1。两个引擎已经安装时，升级计划会明确列出并一起更新它们和共享组件，保留原有启停状态和独立用户资料。

This repository contains the voice plugin wrappers and metadata for Windows x64 and AI Buddy ^2.0.9. Choose Breeze or GPT-SoVITS; both use the same internal shared runtime. Each engine requires shared runtime 1.0.1 exactly. When both engines are installed, the reviewed upgrade plan updates the installed group atomically and preserves enablement and independent user data.

## 下载与准备 / Downloads and preparation

小型插件 ZIP 包含源码与哈希清单。模型、Python 环境和其他运行组件由宿主依据 `assets.json`、`downloads.json` 单独准备；本源码仓库不包含这些大文件、个人参考录音或账户资料。只准备所选引擎和共享组件，不会自动下载另一套 TTS 引擎。

The small plugin ZIPs contain wrapper source and pinned inventories. The host prepares models, Python and other runtime components separately using `assets.json` and `downloads.json`. This repository contains no runtime archives, model weights, personal references or account data. Only the selected engine and shared runtime are prepared; choosing one local engine does not download the other.

| 组件 / Component | 首次网络下载 / Fresh download | 清单展开大小 / Inventory size |
|---|---:|---:|
| 共享识别与云语音 / Shared ASR and cloud runtime | 288,922,906 bytes | 432,623,440 bytes |
| Breeze 引擎 / Breeze engine | 10,892,445,259 bytes | 12,882,035,341 bytes |
| GPT-SoVITS 引擎 / GPT-SoVITS engine | 6,628,886,611 bytes | 9,571,167,222 bytes |

首次选择 Breeze 加共享组件合计约 **11.18 GB**；GPT-SoVITS 加共享组件约 **6.92 GB**，采用十进制 GB。已有组件会按清单复用，临时下载和解压还需要额外空间。表中网络大小包含固定上游权重与 FFmpeg 下载，不能把资源分包大小当成全部下载量。

Fresh Breeze plus shared components totals approximately **11.18 GB**; GPT-SoVITS plus shared totals **6.92 GB**, in decimal GB. Existing verified components can be reused. Temporary downloading/extraction needs additional space. Network totals include fixed upstream weights and FFmpeg, not just the mirrored runtime parts.

用户需自行导入拥有使用权限的角色参考录音；包中没有预置个人声线。GPT-SoVITS 参考片段遵循当前引擎的 3–10 秒要求。MiniMax 需要用户配置自己的密钥、选择声线，并授权需要的参考上传；服务可能计费，费用和服务条款由服务商规定。云模式只准备共享组件，不需要本地 TTS 权重。本地参考不会自动成为相同音色的云端声线。

Import your own authorized reference recordings; no private voice samples are bundled. GPT-SoVITS uses the engine's 3–10 second reference requirement. MiniMax requires your own configured key, selected voice and consent for any reference upload. The service may charge fees under its own terms. Cloud mode needs the shared components but no local TTS weights. A local reference does not automatically create an identical cloud voice.

## 来源和许可 / Sources and notices

包装代码保留 [LICENSE.md](LICENSE.md) 的 Apache-2.0 加 Commons Clause 条件。模型与第三方组件保留各自条款；详见组件中的 `ASSET-NOTICES.md` 和资产清单。Breeze 模型、派生材料及自托管输出包含 BreezeBlue Research and Non-Commercial License v1.1 的研究与非商业限制；商业使用按其说明另行取得许可。GPT-SoVITS 源码及其预训练模型、依赖的条款分别保留。

Wrapper code retains the Apache-2.0 plus Commons Clause terms in [LICENSE.md](LICENSE.md). Models and third-party components retain their own terms in the component `ASSET-NOTICES.md` and inventories. Breeze model materials, derivatives and self-hosted outputs carry the BreezeBlue Research and Non-Commercial License v1.1 research/non-commercial restrictions; its notices call for separate permission for commercial use. GPT-SoVITS source, pretrained materials and dependencies keep their respective notices.

FFmpeg 使用固定 [Gyan 8.1.2 full build 上游归档](https://github.com/GyanD/codexffmpeg/releases/download/8.1.2/ffmpeg-8.1.2-full_build.zip)，归档 SHA-256 为 `b8cdefab5f50590a076c27c2b56b0294a0e6154faded28ba1ba05ebc4f801f57`。宿主只提取并逐文件校验清单中的 `ffmpeg.exe`、`LICENSE` 和 `README.txt`，保留供应方说明；AI Buddy 的资源分包不镜像 FFmpeg。这个技术准备路径不作额外法律授权结论。

FFmpeg is prepared from the fixed [Gyan 8.1.2 full-build upstream archive](https://github.com/GyanD/codexffmpeg/releases/download/8.1.2/ffmpeg-8.1.2-full_build.zip), with the SHA-256 above. The host extracts and verifies only the inventoried executable and its LICENSE/README. AI Buddy runtime parts do not mirror FFmpeg. This preparation path makes no separate legal authorization claim.

## 独立构建 / Standalone build

安装 Node **24.21.0** 后，在源码目录执行；无需宿主、`npm install` 或 `node_modules`：

With Node **24.21.0**, run from this checkout; no host checkout, npm installation or dependencies are needed:

```console
node scripts/build.mjs --out=../voice-artifacts
```

输出目录必须全新且位于源码仓库之外。构建生成三个插件 ZIP、对应的 `release-entry.json` 和含摘要、大小及源码信息的 `packages.json`。`release.json` 固定版本和 `publishedAt`，ZIP 内容采用确定性顺序；相同源字节及固定 Node 版本可重复构建。Git checkout 会记录提交和 tree；从不含 `.git` 的源码归档构建时这两个字段为 null。

Use a fresh output directory outside the source repository. The build produces three plugin ZIPs, their `release-entry.json` files and `packages.json` with hashes, sizes and source information. `release.json` fixes the version and `publishedAt`; ZIP entries are deterministic. Identical source bytes with the pinned Node version reproduce the archives. Git checkouts record the commit/tree; source archives without `.git` record null for those fields.

构建工具 `scripts/package-plugin.mjs` 及两个纯 Node SDK 文件 `src/plugin-archive.mjs`、`src/plugin-manifest.mjs` 从 AI Buddy 集成基线直接复用，字节摘要及来源见 [PROVENANCE.json](PROVENANCE.json)。构建会检查下载覆盖、清单绑定、包内容哈希及私密绝对路径；不会下载模型、启动 worker、调用云 API、签名或发布。正式签名目录、公开资源可达性和安装后的模型/音频验收由发行流程另行记录。

The package tool and its two pure-Node SDK dependencies are copied from the AI Buddy integration baseline; [PROVENANCE.json](PROVENANCE.json) records their source and exact hashes. Building checks download coverage, inventory binding, archive hashes and private absolute paths. It does not download models, start workers, call cloud APIs, sign or publish. Signed catalogs, public URL checks and installed model/audio acceptance are recorded separately by the release process.
