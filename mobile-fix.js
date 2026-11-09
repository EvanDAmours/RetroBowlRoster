// Fixes for playing on phones (iPhone home-screen app, mobile Safari, Android).
// Loaded after html5game/RetroBowl.js and before the game starts.
(function () {
  // 1) Taps did nothing on iOS/Android. When the game sees a phone OS it switches to the
  //    native app's touch-button mode, which does not work in this web build. Report a
  //    desktop OS instead: touches still arrive as pointer input, exactly like the mouse,
  //    so every button and the gameplay controls work.
  if (typeof __u4 === "function" && __u4.prototype && typeof __u4.prototype._OU === "function") {
    var osType = __u4.prototype._OU;
    __u4.prototype._OU = function () {
      var v = osType.apply(this, arguments);
      return v === 3 || v === 4 ? 1 : v; // os_ios / os_android -> os_macosx
    };
  }

  // 1b) On a desktop a click sends both pointer events and mouse events, and the game
  //     listens to both: its "tap to continue" prompts (end of a play, INCOMPLETE, first
  //     down...) react to the mouse release. A finger only sends pointer events, so plays
  //     could be thrown but never finished. Give the game the matching mouse press, move
  //     and release for the primary finger, exactly like a desktop mouse.
  function asMouse(e) {
    return { button: 0, which: 1, pageX: e.pageX, pageY: e.pageY, clientX: e.clientX, clientY: e.clientY,
      target: e.target, preventDefault: function () {}, stopPropagation: function () {} };
  }
  var fingerDown = false;
  window.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch" || !e.isPrimary || e.target.id !== "canvas") return;
    var c = e.target;
    fingerDown = true;
    if (c.onmousemove) c.onmousemove(asMouse(e));
    if (c.onmousedown) c.onmousedown(asMouse(e));
  });
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "touch" || !e.isPrimary || !fingerDown) return;
    var c = document.getElementById("canvas");
    if (c && c.onmousemove) c.onmousemove(asMouse(e));
  });
  function fingerUp(e) {
    if (e.pointerType !== "touch" || !e.isPrimary || !fingerDown) return;
    fingerDown = false;
    var c = document.getElementById("canvas");
    if (c && c.onmousemove) c.onmousemove(asMouse(e));
    if (window.onmouseup) window.onmouseup(asMouse(e));
  }
  window.addEventListener("pointerup", fingerUp);
  window.addEventListener("pointercancel", fingerUp);

  // 2) No dead space on wide phones. The game's menus and HUD are laid out for 16:9, so on
  //    a wider screen (an iPhone 17 Pro is about 2.17:1) it is centred with empty strips at
  //    the sides. Fill those strips every frame by extending the picture's own edge columns,
  //    so the menu background, field and crowd run right to the edges of the screen.
  var bars = [];
  function makeBar(side) {
    var c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    c.style.cssText = "position:fixed;top:0;" + side + ":0;height:100%;width:0;z-index:0;" +
      "pointer-events:none;image-rendering:pixelated";
    document.body.appendChild(c);
    return c;
  }
  function paintBars() {
    var g = document.getElementById("canvas");
    if (g && g.width > 0) {
      if (!bars.length) bars = [makeBar("left"), makeBar("right")];
      var r = g.getBoundingClientRect(), vw = window.innerWidth;
      var widths = [Math.max(0, Math.ceil(r.left)), Math.max(0, Math.ceil(vw - r.right))];
      for (var i = 0; i < 2; i++) {
        var bar = bars[i], w = widths[i];
        bar.style.width = w + "px";
        bar.style.top = r.top + "px";
        bar.style.height = r.height + "px";
        if (w < 1) continue;
        if (bar.height !== g.height) bar.height = g.height;
        var sx = i === 0 ? 0 : g.width - 1;
        try { bar.getContext("2d").drawImage(g, sx, 0, 1, g.height, 0, 0, 1, g.height); } catch (e) {}
      }
    }
    requestAnimationFrame(paintBars);
  }
  requestAnimationFrame(paintBars);
  document.documentElement.style.background = "#000";

  // 3) The game sizes itself once, at startup. If it starts in portrait and the phone is
  //    then turned sideways, it stays tiny. Reload once when that happens.
  function portrait() { return window.innerHeight > window.innerWidth; }
  var startedPortrait = portrait();
  function checkRotation() {
    if (startedPortrait && !portrait()) {
      startedPortrait = false;
      setTimeout(function () { location.reload(); }, 300);
    }
  }
  window.addEventListener("orientationchange", function () { setTimeout(checkRotation, 300); });
  window.addEventListener("resize", checkRotation);

  // Ask the player to turn the phone while it is in portrait.
  var tip = document.createElement("div");
  tip.id = "rotate-tip";
  tip.textContent = "TURN YOUR PHONE SIDEWAYS TO PLAY";
  tip.style.cssText = "position:fixed;inset:0;z-index:20000;display:none;align-items:center;justify-content:center;" +
    "padding:24px;text-align:center;background:#000;color:#fff;font:14px/1.8 'Press Start 2P',monospace";
  document.body.appendChild(tip);
  function updateTip() {
    var touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    tip.style.display = touch && portrait() ? "flex" : "none";
  }
  window.addEventListener("resize", updateTip);
  window.addEventListener("orientationchange", function () { setTimeout(updateTip, 300); });
  updateTip();
})();
