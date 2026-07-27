# AI & Modern Development — Key Terms Glossary

*A working reference for students. Terms are grouped by theme, not alphabetically, so related ideas sit next to each other. Skim the section you need; the whole thing is a study sheet.*

---

## 1. Foundations

| Term | Definition |
|---|---|
| **Artificial Intelligence (AI)** | Software that performs tasks normally requiring human judgment — recognizing, predicting, generating, deciding. An umbrella term, not a specific technology. |
| **Machine Learning (ML)** | A subset of AI where a system learns patterns from data instead of following hand-written rules. |
| **Deep Learning** | ML using neural networks with many layers. Nearly all modern AI (image, speech, language) is deep learning. |
| **Neural Network** | A model made of layers of interconnected "neurons," each applying a weighted sum plus a nonlinearity. Loosely brain-inspired; mathematically just matrix multiplication at scale. |
| **Model** | The trained artifact — the file(s) of learned numbers plus the architecture that uses them. "Downloading a model" means downloading those weights. |
| **Weights / Parameters** | The learned numbers inside a model. "70B parameters" = 70 billion of them. More parameters generally means more capability and more memory required. |
| **Architecture** | The structural blueprint of a model (e.g. Transformer, CNN, RNN). Two models can share an architecture but have completely different weights. |
| **Transformer** | The architecture behind virtually all modern language models. Its key innovation is *attention* (see §2). Introduced in 2017. |
| **Training vs. Inference** | Training = teaching the model (expensive, done once). Inference = using the trained model to produce output (cheap-ish, done constantly). |

---

## 2. How Language Models Actually Work

| Term | Definition |
|---|---|
| **LLM (Large Language Model)** | A large neural network trained to predict the next token in a sequence. That single objective, at scale, produces reasoning, translation, coding, and conversation. |
| **Token** | The unit an LLM reads and writes. Roughly ¾ of a word in English — "unbelievable" might be `un` + `believ` + `able`. Models see tokens, never letters, which is why they struggle to count characters. |
| **Tokenizer** | The component that converts text into token IDs and back. Different model families use different tokenizers. |
| **Embedding** | A list of numbers (a vector) representing meaning. Similar meanings sit close together in that numeric space. Foundation of search, RAG, and recommendation. |
| **Vector** | An ordered list of numbers. An embedding is a vector; so is nearly everything inside a model. |
| **Attention** | The mechanism letting the model weigh which earlier tokens matter when producing the next one. "Self-attention" = the sequence attending to itself. |
| **Context Window** | The maximum number of tokens a model can consider at once — prompt plus response. Exceed it and the earliest content falls out of view. |
| **Next-Token Prediction** | The core operation. The model outputs a probability distribution over the whole vocabulary, then one token is chosen and appended, and the process repeats. |
| **Autoregressive** | Generating one token at a time, each conditioned on all previous ones. Why responses stream in word by word. |
| **Mixture of Experts (MoE)** | An architecture where only a fraction of the model's parameters activate per token. Gives large-model quality at smaller-model inference cost. |
| **Multimodal** | A model that handles more than one input type — text plus images, audio, or video. |

---

## 3. Training

| Term | Definition |
|---|---|
| **Pre-training** | The initial, massive training run on broad data. Where general capability comes from. Costs millions of dollars. |
| **Fine-tuning** | Further training of an existing model on a narrower dataset to specialize it. Vastly cheaper than pre-training. |
| **LoRA (Low-Rank Adaptation)** | A fine-tuning method that trains a small add-on layer instead of the whole model. Fast, cheap, and swappable. |
| **Loss Function** | The formula measuring how wrong a prediction was. Training = making this number go down. |
| **Backpropagation** | The algorithm that computes how much each weight contributed to the error, working backward from output to input. It produces the *gradients*. |
| **Gradient** | The direction and magnitude of change that would reduce the loss for a given weight. |
| **Gradient Descent** | Repeatedly nudging weights in the direction the gradients indicate. The actual "learning" step. |
| **Epoch / Batch** | An epoch is one full pass through the training data. A batch is the chunk of examples processed before each weight update. |
| **Learning Rate** | How big each nudge is. Too high, training diverges; too low, it never finishes. |
| **Overfitting** | The model memorizes training data instead of generalizing. Performs great on training data, poorly on new data. |
| **RLHF (Reinforcement Learning from Human Feedback)** | Training a model against human preference ratings to make it more helpful and less harmful. What turns a raw text predictor into an assistant. |
| **Alignment** | The broad effort to make a model's behaviour match human intent and values. |
| **Distillation** | Training a small model to imitate a large one, capturing much of the capability at a fraction of the size. |

---

## 4. Inference & Running Models

| Term | Definition |
|---|---|
| **Inference** | Running a trained model to get an output. Every chat message you send is an inference request. |
| **Temperature** | Controls randomness in token selection. 0 = deterministic and repetitive; high = creative and erratic. |
| **Top-p / Top-k** | Alternative sampling controls limiting the pool of candidate next tokens. |
| **Sampling** | The act of choosing the next token from the probability distribution. |
| **Latency** | Time from request to response. In voice work, the number that makes or breaks the experience. |
| **TTFT (Time To First Token)** | How long until the first token appears. Perceived responsiveness depends on this more than total time. |
| **Throughput** | Tokens produced per second. |
| **Streaming** | Sending tokens to the user as they're generated rather than waiting for the full response. |
| **Quantization** | Compressing weights to lower precision (e.g. 16-bit → 4-bit) so a model fits smaller hardware. Trades a little accuracy for a lot of memory. |
| **VRAM** | Video memory on a GPU. The practical ceiling on what model you can run locally. |
| **Local Inference** | Running a model on your own hardware rather than calling a cloud API. Better privacy and no per-token cost; limited by your GPU. |
| **KV Cache** | Stored intermediate values from earlier tokens so they don't need recomputing. Speeds up generation, consumes memory. |

---

## 5. Prompting

| Term | Definition |
|---|---|
| **Prompt** | The input text given to a model. |
| **System Prompt** | Instructions setting the model's role, constraints, and behaviour, separate from the user's message. |
| **Prompt Engineering** | The practice of structuring inputs to get reliable outputs. Less mystical than it sounds: be specific, give examples, state the format. |
| **Zero-shot / Few-shot** | Asking with no examples vs. including a few worked examples in the prompt. |
| **Chain of Thought (CoT)** | Prompting the model to reason step by step before answering. Improves accuracy on multi-step problems. |
| **Context** | Everything currently in the model's window — system prompt, history, retrieved documents, tool results. |
| **Prompt Injection** | An attack where malicious instructions hidden in data (a webpage, an email, a document) hijack the model's behaviour. A live, unsolved security problem for agents. |

---

## 6. Retrieval & Knowledge

| Term | Definition |
|---|---|
| **RAG (Retrieval-Augmented Generation)** | Fetching relevant documents and inserting them into the prompt so the model answers from real sources instead of memory. The standard pattern for grounding AI in your own data. |
| **Vector Database** | A database that stores embeddings and finds the nearest matches by meaning. Examples: Pinecone, Chroma, Qdrant, pgvector. |
| **Chunking** | Splitting documents into passages small enough to retrieve and fit in context. Chunk size and overlap materially affect RAG quality. |
| **Semantic Search** | Search by meaning rather than keyword match. |
| **Knowledge Cutoff** | The date after which a model has no training knowledge. Anything later must be supplied via search or retrieval. |
| **Grounding** | Tying a model's output to verifiable sources. |

---

## 7. Agents & Tools

| Term | Definition |
|---|---|
| **Agent** | An LLM given tools and a goal, running in a loop: decide → act → observe → repeat, until the task is done. |
| **Tool Use / Function Calling** | The model outputs a structured request to run a function (search, query a database, send an email), receives the result, and continues. |
| **Agentic Loop** | The repeating cycle of reasoning and action that distinguishes an agent from a single-shot chatbot. |
| **MCP (Model Context Protocol)** | An open standard for connecting models to external tools and data sources — a universal adapter so every integration isn't bespoke. |
| **Orchestration** | Coordinating multiple models, agents, or steps into a working system. |
| **Multi-Agent System** | Several specialized agents dividing a task, often with a coordinator delegating to workers. |
| **Guardrails** | Constraints on what an agent may do — allowed tools, spending caps, human approval for risky actions. |
| **Human in the Loop (HITL)** | A checkpoint requiring human approval before an agent takes a consequential action. |
| **State / Memory** | Information an agent carries between steps or sessions. Models are stateless by default; memory must be engineered. |

---

## 8. Voice Agents

| Term | Definition |
|---|---|
| **STT / ASR (Speech-to-Text / Automatic Speech Recognition)** | Converting spoken audio into text. Whisper is the common open model. |
| **TTS (Text-to-Speech)** | Converting text into spoken audio. |
| **Voice Cloning** | Generating speech in a specific person's voice from a short sample. Powerful and ethically loaded — consent matters. |
| **Voice Pipeline** | The classic three-stage design: STT → LLM → TTS. Modular and debuggable, but latency accumulates at each stage. |
| **Speech-to-Speech** | A single model handling audio in and audio out, skipping the text round trip. Lower latency, preserves tone and emotion, harder to inspect. |
| **VAD (Voice Activity Detection)** | Detecting when someone is actually speaking versus background noise. |
| **Turn Detection / Endpointing** | Deciding when the user has finished their turn so the agent can respond. Get it wrong and the agent either interrupts or feels sluggish. |
| **Barge-in** | Letting the user interrupt mid-response and having the agent stop talking. Essential for natural conversation. |
| **Latency Budget** | The total allowable round-trip time. Under ~800 ms feels conversational; past ~1.5 s feels broken. Every stage spends from this budget. |
| **WER (Word Error Rate)** | The standard accuracy measure for speech recognition. Lower is better. Accents, jargon, and background noise all raise it. |
| **Diarization** | Identifying *who* spoke *when* in multi-speaker audio. |
| **Prosody** | The rhythm, stress, and intonation of speech — what makes synthesized voice sound human or robotic. |
| **SSML** | A markup language for controlling TTS output: pauses, emphasis, pronunciation, speed. |
| **Phoneme** | The smallest unit of speech sound. Used to fix mispronunciations of names and technical terms. |

---

## 9. Version Control & GitHub

| Term | Definition |
|---|---|
| **Git** | The version control system. Tracks every change to your files, who made it, and when. Runs locally. |
| **GitHub** | A hosting platform for Git repositories, plus collaboration tools on top. Git ≠ GitHub. |
| **Repository (Repo)** | A project folder tracked by Git, including its full history. |
| **Commit** | A saved snapshot of changes with a message explaining them. The atomic unit of Git history. |
| **Branch** | A parallel line of development. Lets you work without disturbing the main version. |
| **main** | The conventional name for the primary branch. |
| **Merge** | Combining one branch's changes into another. |
| **Merge Conflict** | When two branches change the same lines and Git can't decide which wins. You resolve it by hand. |
| **Clone** | Downloading a full copy of a remote repo to your machine. |
| **Fork** | Making your own copy of someone else's repo under your account. |
| **Push / Pull** | Push = send your local commits to the remote. Pull = fetch and apply the remote's commits locally. |
| **Pull Request (PR)** | A proposal to merge your branch, opened for review and discussion. The heart of collaborative workflow. |
| **Issue** | A tracked task, bug, or feature request. |
| **README.md** | The front page of a repo. What the project is, how to install it, how to use it. Write it first, not last. |
| **.gitignore** | A file listing what Git should never track — secrets, build output, dependencies. |
| **GitHub Actions** | Automation that runs on repo events: test on every push, deploy on every merge. |
| **CI/CD** | Continuous Integration / Continuous Deployment. Automatically testing and shipping code changes. |
| **Open Source** | Code published under a license permitting use, modification, and redistribution. Terms vary by license — read them. |

---

## 10. APIs & Building

| Term | Definition |
|---|---|
| **API (Application Programming Interface)** | A defined way for one program to request something from another. |
| **Endpoint** | A specific URL an API exposes for a specific operation. |
| **API Key** | A credential authenticating your requests. Treat it like a password: never commit it to a repo. |
| **Environment Variable** | A configuration value stored outside your code — the correct home for API keys. |
| **JSON** | The standard text format for structured data exchange. Keys, values, nesting. |
| **SDK** | A language-specific library wrapping an API so you write less boilerplate. |
| **Rate Limit** | A cap on requests per time period. Exceed it and you get errors. |
| **Webhook** | A reverse API call: the service notifies *you* when something happens. |
| **Container / Docker** | Packaging an application with all its dependencies so it runs identically everywhere. |
| **Localhost** | Your own machine, addressed as a server. Where you test before deploying. |

---

## 11. Evaluation, Risk & Ethics

| Term | Definition |
|---|---|
| **Hallucination** | Confidently stated output that is factually wrong. Not lying — the model has no concept of truth, only likelihood. Always verify consequential claims. |
| **Eval** | A structured test measuring model or system performance on a defined task. If you can't measure it, you can't improve it. |
| **Benchmark** | A standardized public eval used to compare models. Useful directionally; often gamed. |
| **Bias** | Systematic skew in outputs inherited from training data or design choices. |
| **Red Teaming** | Deliberately attacking your own system to find failure modes before someone else does. |
| **Jailbreak** | A prompt crafted to bypass a model's safety behaviour. |
| **PII (Personally Identifiable Information)** | Data identifying an individual. Governs what you may send to a third-party API — check your jurisdiction's privacy law. |
| **Data Residency** | Where data is physically stored and which laws therefore apply to it. |
| **Explainability** | The degree to which a model's reasoning can be inspected and understood. Generally poor for large models. |
| **Automation Bias** | The human tendency to over-trust machine output. The most common real-world AI failure is a person not checking. |

---

## Quick Study Checklist

Can you explain, in one sentence each, without notes?

- [ ] What a token is, and why models miscount letters
- [ ] The difference between training and inference
- [ ] What backpropagation does
- [ ] What the context window limits
- [ ] Why RAG exists
- [ ] What makes an agent different from a chatbot
- [ ] The three stages of a voice pipeline, and where latency accumulates
- [ ] What a pull request is for
- [ ] Why an API key never belongs in a commit
- [ ] Why a hallucination isn't a lie
