// src/FriendMark.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function FriendMark({
  size = 24,
  barColor = "currentColor",
  dotColor = "currentColor",
  className,
  style
}) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "288 288 448 448",
      width: size,
      height: size,
      fill: "none",
      className,
      style,
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "293", y: "332", width: "76", height: "360", rx: "38", fill: barColor }),
        /* @__PURE__ */ jsx("circle", { cx: "584", cy: "512", r: "147", fill: dotColor })
      ]
    }
  );
}

// src/FriendFab.tsx
import { motion, useReducedMotion } from "framer-motion";
import { jsx as jsx2 } from "react/jsx-runtime";
function FriendFab({
  onClick,
  ariaLabel = "Open your Friend",
  markSize = 24,
  className
}) {
  const reduce = useReducedMotion();
  const motionProps = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.18 } } : {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: "spring", stiffness: 420, damping: 26 },
    whileTap: { scale: 0.94 }
  };
  return /* @__PURE__ */ jsx2(
    motion.button,
    {
      type: "button",
      className: className ? `fc-fab ${className}` : "fc-fab",
      onClick,
      "aria-label": ariaLabel,
      ...motionProps,
      children: /* @__PURE__ */ jsx2(FriendMark, { size: markSize, barColor: "var(--fc-mark-bar)", dotColor: "var(--fc-mark-dot)" })
    }
  );
}

// src/FriendChat.tsx
import * as React from "react";
import { AnimatePresence, animate, motion as motion2, useDragControls, useMotionValue, useReducedMotion as useReducedMotion2 } from "framer-motion";

// src/renderReply.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function inline(s) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(
    (p, i) => /^\*\*[^*]+\*\*$/.test(p) ? /* @__PURE__ */ jsx3("strong", { children: p.slice(2, -2) }, i) : /* @__PURE__ */ jsx3("span", { children: p }, i)
  );
}
function renderReply(text) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split(/\n/);
    const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
    if (isList) {
      return /* @__PURE__ */ jsx3("ul", { className: "fc-ul", children: lines.map((l, li) => /* @__PURE__ */ jsx3("li", { children: inline(l.replace(/^\s*[-*•]\s+/, "")) }, li)) }, bi);
    }
    return /* @__PURE__ */ jsx3("p", { className: "fc-p", children: lines.map((l, li) => /* @__PURE__ */ jsxs2("span", { children: [
      inline(l),
      li < lines.length - 1 ? /* @__PURE__ */ jsx3("br", {}) : null
    ] }, li)) }, bi);
  });
}

// src/FriendChat.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function FriendChat({
  app,
  connected,
  ask,
  askStream,
  onConnect,
  friendName: initialName = "Friend",
  examples = [],
  placeholder,
  emptyLine,
  connectTitle,
  connectBody,
  accent,
  onAccent,
  renderExtra,
  renderBody,
  headerActions,
  onOpenChange,
  seed,
  style,
  tabBottom = 116
}) {
  const reduce = useReducedMotion2();
  const dragControls = useDragControls();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [degraded, setDegraded] = React.useState(false);
  const streamRef = React.useRef(null);
  React.useEffect(() => setName(initialName), [initialName]);
  React.useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  const drawerX = useMotionValue(360);
  const [sheetW, setSheetW] = React.useState(360);
  React.useEffect(() => {
    const measure = () => setSheetW(Math.min(390, Math.round(window.innerWidth * 0.9)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  React.useEffect(() => {
    if (!open) drawerX.set(sheetW);
  }, [sheetW, open, drawerX]);
  const openSpring = reduce ? { duration: 0.2 } : { type: "spring", stiffness: 360, damping: 24, mass: 0.9 };
  const shutSpring = reduce ? { duration: 0.18 } : { type: "spring", stiffness: 440, damping: 34, mass: 0.9 };
  function openDrawer() {
    setOpen(true);
    onOpenChange?.(true);
    animate(drawerX, 0, openSpring);
  }
  function closeDrawer() {
    setOpen(false);
    onOpenChange?.(false);
    animate(drawerX, sheetW, shutSpring);
  }
  function toggleDrawer() {
    drawerX.get() > sheetW / 2 ? openDrawer() : closeDrawer();
  }
  const showConnect = !connected || degraded;
  const rootStyle = {
    ...accent ? { ["--fc-accent"]: accent } : null,
    ...onAccent ? { ["--fc-on-accent"]: onAccent } : null,
    ...style
  };
  const scrimMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18 }
  };
  const markTone = { barColor: "var(--fc-on-accent)", dotColor: "var(--fc-on-accent)" };
  async function send(text) {
    const msg = text.trim();
    if (!msg || busy || !ask && !askStream) return;
    setInput("");
    setMessages((m) => [...m, { role: "you", text: msg }]);
    setBusy(true);
    try {
      let res;
      if (askStream) {
        let started = false;
        res = await askStream(msg, (text2) => {
          setMessages((m) => {
            if (!started) {
              started = true;
              return [...m, { role: "friend", text: text2 }];
            }
            const out = m.slice();
            const last = out[out.length - 1];
            if (last && last.role === "friend") out[out.length - 1] = { ...last, text: text2 };
            return out;
          });
        });
        if (!res.friend_connected) {
          setDegraded(true);
          closeDrawer();
          return;
        }
        if (res.friendName) setName(res.friendName);
        setMessages((m) => {
          const out = m.slice();
          const last = out[out.length - 1];
          const text2 = res.reply ?? (started && last?.role === "friend" ? last.text : "...");
          if (started && last && last.role === "friend") out[out.length - 1] = { role: "friend", text: text2, extra: res.extra };
          else out.push({ role: "friend", text: text2, extra: res.extra });
          return out;
        });
        return;
      }
      res = await ask(msg);
      if (!res.friend_connected) {
        setDegraded(true);
        closeDrawer();
        return;
      }
      if (res.friendName) setName(res.friendName);
      setMessages((m) => [...m, { role: "friend", text: res.reply ?? "...", extra: res.extra }]);
    } catch {
      setMessages((m) => [...m, { role: "friend", text: `I could not reach ${name} just then. Try again in a moment.` }]);
    } finally {
      setBusy(false);
    }
  }
  const seedNonce = seed?.nonce ?? 0;
  React.useEffect(() => {
    if (!seedNonce) return;
    openDrawer();
    if (!connected) return;
    const text = seed?.text ?? "";
    if (seed?.autosend && text.trim()) void send(text);
    else if (text) setInput(text);
  }, [seedNonce]);
  const headName = showConnect ? "Friend" : name;
  const headSub = showConnect ? `in ${app}` : `here with you in ${app}`;
  return /* @__PURE__ */ jsxs3("div", { className: "fc-root", style: rootStyle, children: [
    /* @__PURE__ */ jsx4(AnimatePresence, { children: open && /* @__PURE__ */ jsx4(motion2.div, { className: "fc-scrim", onClick: closeDrawer, ...scrimMotion }, "fc-scrim") }),
    /* @__PURE__ */ jsxs3(
      motion2.div,
      {
        className: "fc-drawer",
        style: { x: drawerX },
        drag: "x",
        dragListener: false,
        dragControls,
        dragDirectionLock: true,
        dragConstraints: { left: 0, right: sheetW },
        dragElastic: { top: 0, bottom: 0, left: 0.08, right: 0.16 },
        onDragEnd: (_, info) => {
          const goingClosed = info.velocity.x > 520 || info.velocity.x > -520 && drawerX.get() > sheetW * 0.4;
          if (goingClosed) closeDrawer();
          else openDrawer();
        },
        children: [
          /* @__PURE__ */ jsx4(
            "button",
            {
              className: "fc-tab",
              style: { bottom: tabBottom },
              onClick: toggleDrawer,
              onPointerDown: (e) => dragControls.start(e),
              "aria-label": open ? "Close your Friend" : "Open your Friend",
              children: /* @__PURE__ */ jsx4(FriendMark, { size: 24, ...markTone })
            }
          ),
          /* @__PURE__ */ jsxs3("div", { className: "fc-drawer-inner", role: "dialog", "aria-label": headName, children: [
            /* @__PURE__ */ jsxs3("header", { className: "fc-head", children: [
              /* @__PURE__ */ jsx4("span", { className: "fc-head-mark", children: /* @__PURE__ */ jsx4(FriendMark, { size: 20, ...markTone }) }),
              /* @__PURE__ */ jsxs3("div", { className: "fc-head-txt", children: [
                /* @__PURE__ */ jsx4("span", { className: "fc-head-name", children: headName }),
                /* @__PURE__ */ jsx4("span", { className: "fc-head-sub", children: headSub })
              ] }),
              !showConnect && (headerActions ?? /* @__PURE__ */ jsx4(
                "button",
                {
                  className: "fc-head-friend",
                  onClick: () => window.open("https://friend.ecodia.au", "_blank"),
                  children: "Friend"
                }
              )),
              /* @__PURE__ */ jsx4("button", { className: "fc-head-x", onClick: closeDrawer, "aria-label": "Close", children: "\xD7" })
            ] }),
            showConnect ? /* @__PURE__ */ jsxs3("div", { className: "fc-connect-body", children: [
              /* @__PURE__ */ jsx4("span", { className: "fc-connect-mark", children: /* @__PURE__ */ jsx4(FriendMark, { size: 26, ...markTone }) }),
              /* @__PURE__ */ jsx4("h3", { className: "fc-connect-h", children: connectTitle ?? `Unlock your ${app} Friend` }),
              /* @__PURE__ */ jsx4("p", { className: "fc-connect-p", children: connectBody ?? `Connect your Ecodia Friend and it shows up here inside ${app}: it knows you, and helps you get more out of every visit. One Friend, across everything Ecodia.` }),
              /* @__PURE__ */ jsxs3("button", { className: "fc-connect-cta", onClick: onConnect, children: [
                /* @__PURE__ */ jsx4(FriendMark, { size: 16, ...markTone }),
                " Connect your Friend"
              ] })
            ] }) : renderBody ? (
              // The app brought its own conversation surface (Studio's agentic chat).
              // The drawer chrome above and around it is unchanged, so it is still the
              // one federated Friend drawer.
              /* @__PURE__ */ jsx4("div", { className: "fc-body", children: renderBody() })
            ) : /* @__PURE__ */ jsxs3(Fragment, { children: [
              /* @__PURE__ */ jsxs3("div", { className: "fc-stream", ref: streamRef, children: [
                messages.length === 0 && !busy && /* @__PURE__ */ jsxs3("div", { className: "fc-empty", children: [
                  /* @__PURE__ */ jsx4("p", { className: "fc-empty-line", children: emptyLine ?? `I am ${name}, here with you in ${app}. Ask me anything.` }),
                  examples.length > 0 && /* @__PURE__ */ jsx4("div", { className: "fc-examples", children: examples.map((ex) => /* @__PURE__ */ jsx4("button", { className: "fc-example", onClick: () => send(ex), children: ex }, ex)) })
                ] }),
                messages.map(
                  (m, i) => m.role === "you" ? /* @__PURE__ */ jsx4("div", { className: "fc-you", children: m.text }, i) : /* @__PURE__ */ jsxs3("div", { className: "fc-friend", children: [
                    renderReply(m.text),
                    renderExtra && m.extra != null ? renderExtra(m.extra) : null
                  ] }, i)
                ),
                busy && /* @__PURE__ */ jsxs3("div", { className: "fc-friend fc-thinking", "aria-live": "polite", children: [
                  /* @__PURE__ */ jsx4("span", { className: "fc-dot" }),
                  /* @__PURE__ */ jsx4("span", { className: "fc-dot" }),
                  /* @__PURE__ */ jsx4("span", { className: "fc-dot" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs3(
                "form",
                {
                  className: "fc-compose",
                  onSubmit: (e) => {
                    e.preventDefault();
                    void send(input);
                  },
                  children: [
                    /* @__PURE__ */ jsx4(
                      "input",
                      {
                        className: "fc-input",
                        value: input,
                        onChange: (e) => setInput(e.target.value),
                        placeholder: placeholder ?? `Ask ${name}...`,
                        disabled: busy,
                        autoComplete: "off"
                      }
                    ),
                    /* @__PURE__ */ jsx4("button", { className: "fc-send", type: "submit", disabled: busy || !input.trim(), "aria-label": "Send", children: "\u2192" })
                  ]
                }
              )
            ] })
          ] })
        ]
      }
    )
  ] });
}
export {
  FriendChat,
  FriendFab,
  FriendMark,
  renderReply
};
//# sourceMappingURL=index.js.map