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
import * as React2 from "react";
import { AnimatePresence, animate, motion as motion2, useDragControls, useMotionValue, useReducedMotion as useReducedMotion2 } from "framer-motion";

// src/renderReply.tsx
import * as React from "react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var URL_CORE = `https?:\\/\\/[^\\s<>()\\[\\]]+[^\\s<>()\\[\\].,;:!?'"]`;
var IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?[^\s]*)?$/i;
function isImageUrl(u) {
  return IMG_EXT.test(u) || /\/storage\/v1\/object\/(public|sign)\//.test(u) || /\/_next\/image\?/.test(u);
}
function labelForUrl(u) {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
    return url.hostname.replace(/^www\./, "") + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return "link";
  }
}
function imageNode(url, alt, key) {
  return /* @__PURE__ */ jsxs2("a", { className: "fc-imglink", href: url, target: "_blank", rel: "noopener noreferrer", title: alt || "Open image", children: [
    /* @__PURE__ */ jsx3("img", { className: "fc-img", src: url, alt: alt || "image", loading: "lazy" }),
    alt ? /* @__PURE__ */ jsx3("span", { className: "fc-imgcap", children: alt }) : null
  ] }, key);
}
function linkNode(url, text, key) {
  return /* @__PURE__ */ jsx3("a", { className: "fc-link", href: url, target: "_blank", rel: "noopener noreferrer", children: text }, key);
}
var INLINE_RE = new RegExp(
  [
    "!\\[([^\\]]*)\\]\\((" + URL_CORE + ")\\)",
    // 1 alt, 2 url   -> ![alt](url)
    "\\[([^\\]]+)\\]\\((" + URL_CORE + ")\\)",
    // 3 text, 4 url  -> [text](url)
    "`([^`]+)`",
    // 5 code
    "\\*\\*([^*]+)\\*\\*",
    // 6 bold
    "\\*([^*]+)\\*",
    // 7 italic
    "(" + URL_CORE + ")"
    // 8 bare url
  ].join("|"),
  "g"
);
function inline(s, keyPrefix) {
  const out = [];
  let last = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  let n = 0;
  while ((m = INLINE_RE.exec(s)) !== null) {
    if (m.index > last) out.push(/* @__PURE__ */ jsx3(React.Fragment, { children: s.slice(last, m.index) }, `${keyPrefix}t${n}`));
    const k = `${keyPrefix}n${n}`;
    if (m[1] !== void 0 && m[2]) out.push(imageNode(m[2], m[1], k));
    else if (m[3] !== void 0 && m[4]) {
      out.push(linkNode(m[4], /^https?:\/\//.test(m[3]) ? labelForUrl(m[4]) : m[3], k));
    } else if (m[5] !== void 0) out.push(/* @__PURE__ */ jsx3("code", { className: "fc-code", children: m[5] }, k));
    else if (m[6] !== void 0) out.push(/* @__PURE__ */ jsx3("strong", { children: m[6] }, k));
    else if (m[7] !== void 0) out.push(/* @__PURE__ */ jsx3("em", { children: m[7] }, k));
    else if (m[8]) out.push(isImageUrl(m[8]) ? imageNode(m[8], "", k) : linkNode(m[8], labelForUrl(m[8]), k));
    last = m.index + m[0].length;
    n += 1;
  }
  if (last < s.length) out.push(/* @__PURE__ */ jsx3(React.Fragment, { children: s.slice(last) }, `${keyPrefix}t${n}`));
  return out;
}
var UL_RE = /^\s*[-*•]\s+/;
var OL_RE = /^\s*\d+[.)]\s+/;
var H_RE = /^\s*(#{1,3})\s+(.*)$/;
function renderReply(text) {
  const blocks = (text ?? "").split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split(/\n/).filter((l, i, a) => l.trim() !== "" || i > 0 && i < a.length - 1);
    if (!lines.length) return null;
    const h = lines.length === 1 ? lines[0].match(H_RE) : null;
    if (h) {
      const level = h[1].length;
      const cls = `fc-h fc-h${level}`;
      return level === 1 ? /* @__PURE__ */ jsx3("h4", { className: cls, children: inline(h[2], `${bi}-`) }, bi) : level === 2 ? /* @__PURE__ */ jsx3("h5", { className: cls, children: inline(h[2], `${bi}-`) }, bi) : /* @__PURE__ */ jsx3("h6", { className: cls, children: inline(h[2], `${bi}-`) }, bi);
    }
    if (lines.every((l) => UL_RE.test(l))) {
      return /* @__PURE__ */ jsx3("ul", { className: "fc-ul", children: lines.map((l, li) => /* @__PURE__ */ jsx3("li", { children: inline(l.replace(UL_RE, ""), `${bi}-${li}-`) }, li)) }, bi);
    }
    if (lines.every((l) => OL_RE.test(l))) {
      return /* @__PURE__ */ jsx3("ol", { className: "fc-ol", children: lines.map((l, li) => /* @__PURE__ */ jsx3("li", { children: inline(l.replace(OL_RE, ""), `${bi}-${li}-`) }, li)) }, bi);
    }
    return /* @__PURE__ */ jsx3("p", { className: "fc-p", children: lines.map((l, li) => /* @__PURE__ */ jsxs2("span", { children: [
      inline(l, `${bi}-${li}-`),
      li < lines.length - 1 ? /* @__PURE__ */ jsx3("br", {}) : null
    ] }, li)) }, bi);
  });
}

// src/FriendChat.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
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
  tabBottom = 116,
  modal = true
}) {
  const reduce = useReducedMotion2();
  const dragControls = useDragControls();
  const [open, setOpen] = React2.useState(false);
  const [messages, setMessages] = React2.useState([]);
  const [input, setInput] = React2.useState("");
  const [busy, setBusy] = React2.useState(false);
  const abortRef = React2.useRef(null);
  const [stopping, setStopping] = React2.useState(false);
  function stop() {
    setStopping(true);
    abortRef.current?.abort();
  }
  const queueRef = React2.useRef([]);
  const busyRef = React2.useRef(false);
  const [name, setName] = React2.useState(initialName);
  const [degraded, setDegraded] = React2.useState(false);
  const streamRef = React2.useRef(null);
  React2.useEffect(() => setName(initialName), [initialName]);
  React2.useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  const drawerX = useMotionValue(360);
  const [sheetW, setSheetW] = React2.useState(360);
  React2.useEffect(() => {
    const measure = () => setSheetW(Math.min(390, Math.round(window.innerWidth * 0.9)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  React2.useEffect(() => {
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
  async function send(text, fromQueue = false) {
    const msg = text.trim();
    if (!msg || !ask && !askStream) return;
    if (busyRef.current && !fromQueue) {
      queueRef.current = [...queueRef.current, { text: msg }];
      setMessages((m) => [...m, { role: "you", text: msg, queued: true }]);
      setInput("");
      return;
    }
    setInput("");
    setMessages((m) => {
      if (!fromQueue) return [...m, { role: "you", text: msg }];
      const i = m.findIndex((x) => x.queued);
      if (i < 0) return [...m, { role: "you", text: msg }];
      return [...m.slice(0, i), { ...m[i], queued: false }, ...m.slice(i + 1)];
    });
    busyRef.current = true;
    setBusy(true);
    setStopping(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let res;
      if (askStream) {
        let started = false;
        res = await askStream(msg, (text2) => {
          if (ctrl.signal.aborted) return;
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
          queueRef.current = [];
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
    } catch (err) {
      const aborted = ctrl.signal.aborted || err instanceof DOMException && err.name === "AbortError";
      if (aborted) {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last && last.role === "friend") return m;
          return [...m, { role: "friend", text: "Stopped." }];
        });
      } else {
        setMessages((m) => [...m, { role: "friend", text: `I could not reach ${name} just then. Try again in a moment.` }]);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStopping(false);
      abortRef.current = null;
      const next = queueRef.current[0];
      if (next) {
        queueRef.current = queueRef.current.slice(1);
        void send(next.text, true);
      }
    }
  }
  const seedNonce = seed?.nonce ?? 0;
  React2.useEffect(() => {
    if (!seedNonce) return;
    openDrawer();
    if (!connected) return;
    const text = seed?.text ?? "";
    if (seed?.autosend && text.trim()) void send(text);
    else if (text) setInput(text);
  }, [seedNonce]);
  const headName = showConnect ? "Friend" : name;
  const headSub = showConnect ? `in ${app}` : `here with you in ${app}`;
  return /* @__PURE__ */ jsxs3("div", { className: `fc-root${modal ? "" : " fc-nonmodal"}`, style: rootStyle, children: [
    /* @__PURE__ */ jsx4(AnimatePresence, { children: modal && open && /* @__PURE__ */ jsx4(motion2.div, { className: "fc-scrim", onClick: closeDrawer, ...scrimMotion }, "fc-scrim") }),
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
          /* @__PURE__ */ jsxs3(
            "div",
            {
              className: "fc-drawer-inner",
              role: "dialog",
              "aria-modal": modal ? true : void 0,
              "aria-label": headName,
              children: [
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
                ) : /* @__PURE__ */ jsxs3(Fragment2, { children: [
                  /* @__PURE__ */ jsxs3("div", { className: "fc-stream", ref: streamRef, children: [
                    messages.length === 0 && !busy && /* @__PURE__ */ jsxs3("div", { className: "fc-empty", children: [
                      /* @__PURE__ */ jsx4("p", { className: "fc-empty-line", children: emptyLine ?? `I am ${name}, here with you in ${app}. Ask me anything.` }),
                      examples.length > 0 && /* @__PURE__ */ jsx4("div", { className: "fc-examples", children: examples.map((ex) => /* @__PURE__ */ jsx4("button", { className: "fc-example", onClick: () => send(ex), children: ex }, ex)) })
                    ] }),
                    messages.map(
                      (m, i) => m.role === "you" ? /* @__PURE__ */ jsxs3("div", { className: "fc-turn", children: [
                        /* @__PURE__ */ jsx4("div", { className: "fc-you", children: m.text }),
                        m.queued ? /* @__PURE__ */ jsx4("div", { className: "fc-queued", "aria-live": "polite", children: "queued: answered next" }) : null
                      ] }, i) : /* @__PURE__ */ jsxs3("div", { className: "fc-friend", children: [
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
                            autoComplete: "off"
                          }
                        ),
                        busy && input.trim() ? /* @__PURE__ */ jsx4(
                          "button",
                          {
                            className: "fc-send fc-stop fc-stop-aside",
                            type: "button",
                            onClick: stop,
                            disabled: stopping,
                            "aria-label": "Stop",
                            title: "Stop",
                            children: /* @__PURE__ */ jsx4("span", { className: "fc-stop-sq", "aria-hidden": true })
                          }
                        ) : null,
                        busy && !input.trim() ? /* @__PURE__ */ jsx4("button", { className: "fc-send fc-stop", type: "button", onClick: stop, disabled: stopping, "aria-label": "Stop", title: "Stop", children: /* @__PURE__ */ jsx4("span", { className: "fc-stop-sq", "aria-hidden": true }) }) : /* @__PURE__ */ jsx4(
                          "button",
                          {
                            className: "fc-send",
                            type: "submit",
                            disabled: !input.trim(),
                            "aria-label": "Send",
                            title: busy ? `${name} is still replying. Send now and it is answered next.` : "Send",
                            children: "\u2192"
                          }
                        )
                      ]
                    }
                  )
                ] })
              ]
            }
          )
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