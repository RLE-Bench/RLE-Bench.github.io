我会从第三节开始明显改变重心：**前两节负责建立“为什么 physical-world agency 值得测、我们测哪些能力”；第三节以后就不要再按 benchmark mechanics 顺序讲，而是按“agent 在这里经历什么、我们从结果里学到什么”来讲。**

现在第三节是 **Development and independent evaluation**，这个标题太 benchmark / methodology 了。对于 blog，我建议把它变成：

## Agents learn by acting, not just by writing code

这一节核心不是 Harbor、verifier、sandbox，而是让 reader 看到这个 benchmark 的 agent loop：

> agent gets a task → makes a hypothesis → changes something → acts in simulation → sees physical consequences → revises its approach.

你现在 protocol figure 其实非常适合这个故事，只是文字解释得太“evaluation protocol”。

开头我会写成这种 blog 风格：

## Agents learn by acting, not just by writing code

In RLE-Bench, writing code is only one part of the job. Agents can run their solutions, observe what happens in simulation, and use those outcomes to decide what to try next.

This creates a simple loop: **build, act, observe, revise.** A controller that looks correct in code may still collide with the environment; a mechanical design may reach its target but become unstable; a training recipe may run successfully without producing robust behavior. The simulator turns these failures into feedback the agent can act on.

然后 figure 里的 **Agent development / Independent evaluation** 可以保留，但 framing 改成：

* 左边：**agent learning loop**
* 中间：**submitted artifact**
* 右边：**hidden physical test**

最后一句讲 benchmark integrity 就够了：

> Once development ends, the agent’s solution is evaluated under hidden physical conditions it cannot tune against directly.

Harbor、network disabled、sandbox 这些都可以压成一个小 note，不值得占主 narrative。

---

# 第四节：我甚至会弱化 scoring section

现在单独一节：

> The RLE Index and capability profiles

对于 paper 有必要，但对 blog 来说，**scoring 不应该成为 storyline 的第四个大 section**。

我建议缩成一个很短的 section，甚至和 results 合并。

标题：

## One score, four different capabilities

只需要解释一个 intuition：

> Each task produces a normalized score. We first aggregate tasks within each capability family, then average the four families equally into the RLE Index.

然后马上说：

> But the family profile often tells us more than the final number.

这句话正好 lead into results。

甚至这一节可以只有 2 paragraphs + equation graphic，不要解释 T06 worst-arm reduction 这种细节。那些更适合 paper / docs。

---

# 第五节应该成为整篇 blog 的中心

现在：

> Initial results across coding-agent systems

太像 leaderboard report。

我会改成：

# What can today’s agents actually do?

然后不要按照 table 从上往下报数字，而是先给 **3–4 个 findings**。

我会强烈建议你把这节写成类似：

### Multimodal grounding is improving fast

GPT-6 perception 72 vs Opus 43，而且 interactive 也很强。

故事不是 “GPT-6 wins”。

而是：

> The largest gains appear in tasks where agents must interpret rich environmental feedback and turn it into action.

这非常 agent-centric。

---

### Learning pipelines are becoming easier for agents

GPT-6 / Opus 5 / Sol 在 learning 比较接近。

可以说：

> On policy learning, the frontier systems are already relatively close. Running experiments, modifying training code, and improving a learned controller may be becoming a more mature capability for coding agents.

不要过度 claim saturation，但可以讲 “gap is noticeably smaller”。

---

### Physical design remains surprisingly hard

这里 T06 case 非常好。

现在你已经有：

* Astra shelf access full
* payload margin full
* static stability zero
* turning / lateral zero



这可以直接上升到：

> Agents can optimize what is easy to observe while missing consequences that only appear when the system is physically tested.

这句话很有价值。

---

### Capability is not one-dimensional

把 Opus 4.8 embodiment 47.75 / perception 7.33 拿出来。

你现在已经有这个 observation。

但结论不要是：

> therefore aggregate insufficient.

而是：

> A strong coding agent does not automatically become a strong physical-world agent. Different forms of grounding emerge at different rates.

我觉得这句话特别适合 blog。

---

# 第六节：Harness 其实可以变成很好的 agent research section

现在：

> How robotics scaffolding affects performance

我建议：

# How much robotics knowledge does an agent need?

这个标题很容易让人想继续读。

你真正的问题是：

> intelligence is in model 还是 environment/tooling？

T01 的 L1/L2/L3 是非常自然的实验。

可以先用一句：

> Today’s coding agents do not enter robotics empty-handed: we often give them perception models, coordinate transforms, motion primitives, or even privileged state. How much do these abstractions matter as the underlying agent gets stronger?

然后讲结果。

最有意思的 conclusion 就是：

> weaker agents benefit significantly from robotics scaffolding, but the strongest agent already performs well with much less help.

这实际上是在回答一个很 general 的 agent question：

> **Will stronger models reduce the amount of domain-specific scaffolding we need?**

这比现在“L2 = SAM3 + Contact-GraspNet”更值得突出。

具体工具名字放 collapse / details 里即可。

---

# 第七节：T02 是我觉得你现在低估最多的一节

现在标题：

> Evaluating the transfer of reusable tools

我会改成：

# Can one agent make another agent better?

这个非常抓人，而且本质上就是 T02。

你现在 T02 的实验设置本来就很漂亮：

> developer agent → tools/manual → fresh agent → held-out task



开头直接写：

> Solving a task yourself is one thing. Building something that helps a different agent solve a new task is harder.

然后：

> In T02, one agent develops a robotics harness. A fresh agent receives only the resulting tools and documentation—not the original conversation—and must use them on a held-out task.

然后核心 research implication：

> This lets us ask whether agents can leave behind abstractions that outlive their own context.

我很喜欢这句话。

它甚至已经接近 agent self-improvement / collective improvement 的味道，但又没有 overclaim RSI。

---

# 第八节：Design 也可以改成 agent reasoning failure

现在：

> Physical constraints in embodiment design

我会改成：

# When plausible designs fail physics

这个作为 blog 标题非常好。

先展示两个设计图，再讲：

> Both can look superficially reasonable. The simulator tells a different story.

然后 Astra case：

> it reaches shelves and carries payloads, yet fails stability checks.

Luna：

> disconnected frame despite explicit requirement.

这里的 point 不应该是“physical constraints are distinct engineering requirements”，而是：

> **Agents often optimize visible objectives while missing coupled physical consequences.**

这和你第一节的 thesis 完全闭环。

甚至可以说：

> Code can be inspected line by line. Physical consequences often cannot.

这类句子很适合 blog。

---

# 最后一节也要从 benchmark roadmap 变成 agent outlook

现在：

> Scope and research directions

可以改成：

# Toward agents that learn from the physical world

然后不要主要讲：

* uncertainty
* completing remaining tasks
* resource use

这些是 release notes。

而是回到开头的问题：

> Can agents close the loop with the physical world?

然后说目前看到的是：

* multimodal grounding 在快速进步；
* optimization / training 已经比较成熟；
* physical consequence reasoning 依然弱；
* domain scaffolding 对 weaker agents 很重要；
* agents 开始可以创造 reusable tools 给别的 agents。

最后一句可以很 strong：

> The next generation of coding agents may not simply write better robotics software. They may increasingly learn how the physical world responds to what they build.

---

所以我会把后半篇最后重组成这样：

1. **From digital agents to physically grounded agents**
2. **Complementary views of physically grounded agent capability**
3. **Agents learn by acting, not just by writing code**
4. **One score, four different capabilities**
5. **What can today’s agents actually do?**
6. **How much robotics knowledge does an agent need?**
7. **Can one agent make another agent better?**
8. **When plausible designs fail physics**
9. **Toward agents that learn from the physical world**

这个顺序会比现在明显更像一个 **agent research story**：

**motivation → capability → agent loop → measurement → findings → model/tool interaction → agent-to-agent transfer → failure mode → future**

而不是现在的：

**motivation → tasks → protocol → scoring → results → harness → transfer → design → limitations**。

我觉得这是你这次改 blog 最值得做的 structural change。
