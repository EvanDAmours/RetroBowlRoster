// NFL presentation mod: NFL team names / abbreviations, team logos (spr_nfl_logos),
// midfield logo and endzone team names. Loaded after RetroBowl.js, before mod-menu.js.
(function () {
  var LOGO_SPRITE = 205; // spr_nfl_logos, frame == team uid (see tools/nfl)

  // uid: [old city name, NFL name, old abbreviation, NFL abbreviation]
  var TEAMS = [
    ["Buffalo", "Bills", "BUF", "BUF"], ["Miami", "Dolphins", "MIA", "MIA"],
    ["New England", "Patriots", "N.E", "NE"], ["New York J", "Jets", "NYJ", "NYJ"],
    ["Denver", "Broncos", "DEN", "DEN"], ["Kansas City", "Chiefs", "K.C", "KC"],
    ["Los Angeles C", "Chargers", "LAC", "LAC"], ["Las Vegas", "Raiders", "L.V", "LV"],
    ["Baltimore", "Ravens", "BAL", "BAL"], ["Cincinnati", "Bengals", "CIN", "CIN"],
    ["Cleveland", "Browns", "CLE", "CLE"], ["Pittsburgh", "Steelers", "PIT", "PIT"],
    ["Houston", "Texans", "HOU", "HOU"], ["Indianapolis", "Colts", "IND", "IND"],
    ["Jacksonville", "Jaguars", "JAC", "JAX"], ["Tennessee", "Titans", "TEN", "TEN"],
    ["Dallas", "Cowboys", "DAL", "DAL"], ["New York G", "Giants", "NYG", "NYG"],
    ["Philadelphia", "Eagles", "PHI", "PHI"], ["Washington", "Commanders", "WAS", "WAS"],
    ["Arizona", "Cardinals", "ARI", "ARI"], ["Los Angeles R", "Rams", "LAR", "LAR"],
    ["San Francisco", "49ers", "S.F", "SF"], ["Seattle", "Seahawks", "SEA", "SEA"],
    ["Chicago", "Bears", "CHI", "CHI"], ["Detroit", "Lions", "DET", "DET"],
    ["Green Bay", "Packers", "G.B", "GB"], ["Minnesota", "Vikings", "MIN", "MIN"],
    ["Atlanta", "Falcons", "ATL", "ATL"], ["Carolina", "Panthers", "CAR", "CAR"],
    ["New Orleans", "Saints", "N.O", "NO"], ["Tampa Bay", "Buccaneers", "T.B", "TB"]
  ];

  var nameToUid = {};
  TEAMS.forEach(function (t, uid) {
    nameToUid[t[1].toUpperCase()] = uid;
    nameToUid[t[0].toUpperCase()] = uid;
    nameToUid[(t[0] + " " + t[1]).toUpperCase()] = uid;
  });

  // ---------- save migration: rename teams inside existing saves ----------
  // GameMaker ds_map hex: u32 version, u32 count, then key/value pairs where each
  // value is u32 type (0 = f64 real, 1 = u32 length + utf8 string).
  function hexToBytes(h) {
    var b = new Uint8Array(h.length / 2);
    for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
    return b;
  }
  function bytesToHex(b) {
    var s = "";
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16).toUpperCase();
    return s;
  }
  function decodeMap(hex) {
    var b = hexToBytes(hex), dv = new DataView(b.buffer), p = 8, out = [];
    var n = dv.getUint32(4, true);
    function val() {
      var type = dv.getUint32(p, true); p += 4;
      if (type === 0) { var r = dv.getFloat64(p, true); p += 8; return { t: 0, v: r }; }
      if (type === 1) {
        var len = dv.getUint32(p, true); p += 4;
        var str = new TextDecoder().decode(b.subarray(p, p + len)); p += len;
        return { t: 1, v: str };
      }
      throw new Error("unsupported ds_map value type " + type);
    }
    for (var i = 0; i < n; i++) out.push([val(), val()]);
    return { version: dv.getUint32(0, true), entries: out };
  }
  function encodeMap(m) {
    var parts = [], enc = new TextEncoder();
    function u32(x) { var a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, x, true); parts.push(a); }
    function val(v) {
      u32(v.t);
      if (v.t === 0) { var a = new Uint8Array(8); new DataView(a.buffer).setFloat64(0, v.v, true); parts.push(a); }
      else { var s = enc.encode(v.v); u32(s.length); parts.push(s); }
    }
    u32(m.version); u32(m.entries.length);
    m.entries.forEach(function (e) { val(e[0]); val(e[1]); });
    var len = parts.reduce(function (a, p) { return a + p.length; }, 0), out = new Uint8Array(len), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return bytesToHex(out);
  }

  function migrateTeamMap(hex) {
    var m = decodeMap(hex), get = {};
    m.entries.forEach(function (e) { get[e[0].v] = e[1]; });
    var uid = get.uid ? Number(get.uid.v) : -1, t = TEAMS[uid];
    if (!t) return hex;
    var changed = false;
    if (get.name && get.name.v === t[0]) { get.name.v = t[1]; changed = true; }
    if (get.tla && get.tla.v === t[2]) { get.tla.v = t[3]; changed = true; }
    return changed ? encodeMap(m) : hex;
  }

  function migrateSave(key) {
    var ini = localStorage.getItem(key);
    if (!ini || ini.indexOf("teamlist_0=") === -1) return;
    var changed = false;
    var next = ini.replace(/(teamlist_\d+=")([0-9A-Fa-f]+)(")/g, function (all, a, hex, c) {
      try {
        var h = migrateTeamMap(hex);
        if (h !== hex) { changed = true; return a + h + c; }
      } catch (err) {}
      return all;
    });
    if (changed) localStorage.setItem(key, next);
  }
  try {
    ["RetroBowl.0.savedata.ini", "RetroBowlModded.0.savedata.ini"].forEach(migrateSave);
  } catch (err) {}
  window.NFLMod = { migrateSave: migrateSave, teams: TEAMS };

  // ---------- drawing hooks ----------
  if (typeof _nh1 !== "function" || typeof _mh1 !== "function") return;

  var drawText = _nh1, drawTextColour = _RD1, drawTextTransformed = __G1, drawSprite = _mh1;
  var recent = {};

  function drawLogoBeside(uid, x, y, str) {
    // returns the x shift to apply to the text so logo + text stay aligned
    var w = _lh1(str), h = _lF1(str);
    var halign = _nD2._iF2, valign = _nD2._jF2;
    // small table text gets a compact logo; headline text a bigger one
    var small = h < 17;
    var scale = small ? 12 / 28 : Math.round((h * 1.5 / 28) * 2) / 2;
    var size = 28 * scale, gap = small ? 3 : Math.max(2, h * 0.3);
    // list/table rows are often clipped to their box, so push left-aligned
    // small text right and put the logo where the text used to start
    var shift = small && halign === 0 ? size + gap : 0;
    var left = x + shift - (halign === 1 ? w / 2 : halign === 2 ? w : 0);
    var cy = y + (valign === 0 ? h / 2 : valign === 2 ? -h / 2 : 0);
    var now = performance.now(), key = str, r = recent[key];
    // text with a drop shadow is drawn twice; only draw one logo
    if (!(r && now - r.t < 10 && Math.abs(r.x - x) <= 3 && Math.abs(r.y - y) <= 3)) {
      drawSprite(null, LOGO_SPRITE, uid, left - gap - size / 2, cy, scale, scale, 0, 16777215, 1);
    }
    recent[key] = { t: now, x: x, y: y };
    return shift;
  }

  function teamUidFor(str) {
    if (typeof str !== "string" || str.length > 24) return -1;
    var u = nameToUid[str.trim().toUpperCase()];
    return u === undefined ? -1 : u;
  }

  window._nh1 = function (x, y, str) {
    var uid = teamUidFor(str);
    if (uid >= 0) { try { x += drawLogoBeside(uid, x, y, str); } catch (e) { console.log("NFLMOD text error " + e.stack); } }
    return drawText(x, y, str);
  };
  window._RD1 = function (x, y, str, c1, c2, c3, c4, a) {
    var uid = teamUidFor(str);
    if (uid >= 0) { try { x += drawLogoBeside(uid, x, y, str); } catch (e) { console.log("NFLMOD text error " + e.stack); } }
    return drawTextColour(x, y, str, c1, c2, c3, c4, a);
  };

  function homeTeam(inst) {
    try {
      var g = _jj(inst, inst, 64), teams = g && g._Fj;
      if (!teams) return null;
      var map = teams[1];
      var uid = Number(_Ai(map, "uid"));
      if (!(uid >= 0 && uid < 32)) return null;
      return { uid: uid, name: String(_Ai(map, "name") || TEAMS[uid][1]) };
    } catch (e) { return null; }
  }

  // The field object draws both endzones (spr_endzone = 24) right before the players.
  // After the second endzone, paint the home team's logo at midfield and its
  // name in both endzones.
  window._mh1 = function (inst, spr, sub, x, y, xs, ys, rot, col, alpha) {
    drawSprite(inst, spr, sub, x, y, xs, ys, rot, col, alpha);
    if (spr === 24 && x === 2302 && y === 132) {
      var home = homeTeam(inst);
      if (!home) return;
      try {
        drawSprite(null, LOGO_SPRITE, home.uid, 1301, 301, 5, 5, 0, 16777215, 0.9);
        var oldCol = _2J2(), oldFont = _nD2._lF2, oldH = _nD2._iF2, oldV = _nD2._jF2;
        var label = home.name.toUpperCase();
        _gh1(2); _hh1(1); _ih1(1);
        var w = _lh1(label), h = _lF1(label);
        var s = Math.min(4, 300 / Math.max(1, w), 150 / Math.max(1, h));
        _Eh1(0x000000);
        drawTextTransformed(200 + 3, 301 + 3, label, s, s, 90);
        drawTextTransformed(2402 - 3, 301 + 3, label, s, s, 270);
        _Eh1(0xffffff);
        drawTextTransformed(200, 301, label, s, s, 90);
        drawTextTransformed(2402, 301, label, s, s, 270);
        _Eh1(oldCol); _gh1(oldFont); _hh1(oldH); _ih1(oldV);
      } catch (e) { console.log("NFLMOD endzone error " + e.stack); }
    }
  };
})();
