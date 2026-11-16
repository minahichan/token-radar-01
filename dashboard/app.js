// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own inputs and the protocol's farm plan. No network: every
// byte it shows is in data.js. The page recomputes each row's implied value from the
// snapshot figures and checks the number board.json carries, so the page's code and
// the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;
  var M = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', sort: 'implied', watchlist: false, tab: 'board', selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // The model in one function: the same four factors main.ts applies, recomputed here
  // from the row's own figures and the comparable multiple the board carries.
  function impliedOf(row) {
    var growth = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, M.growth_floor, M.growth_cap);
    var growthMult = 1 + (growth / 100) * M.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    var tenure = M.tenure_floor + (clamp(age, 0, M.tenure_days) / M.tenure_days) * M.tenure_range;
    var breadth = 1 + M.breadth_step * Math.min(Math.max(row.chains.length - 1, 0), M.breadth_max_chains);
    return Math.max(1, Math.round(row.tvl_usd * row.comparable_multiple * growthMult * tenure * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- farm plan: the same derivation main.ts writes to board.json ----
  function chainOf(row) { return row.chains.length > 0 ? row.chains[0] : 'its main chain'; }
  function capitalFor(row) {
    if (row.tvl_usd >= 1e9) return 200;
    if (row.tvl_usd >= 250e6) return 150;
    if (row.tvl_usd >= 100e6) return 100;
    return 50;
  }
  function holdFor(row) {
    if (row.age_days === null || row.age_days === undefined) return 30;
    if (row.age_days < 180) return 60;
    if (row.age_days < 365) return 45;
    return 30;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and borrow a small amount against it to show both sides of the market.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + "'s deepest pool on " + chain + ' and keep the position in range.';
    if (c.indexOf('yield') >= 0 || c.indexOf('aggregator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + name + ', then use the bridged funds inside its own app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' and take one position in an active market.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s basis vault on " + chain + ' and hold the position.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and use its main feature once.';
  }
  function weeklyFor(row) {
    var c = (row.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Repay a little of the borrow, top the supply up, or adjust the collateral once a week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap a small amount through the pool, or rebalance the range, once a week.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge a small amount again, on a different day, once a week.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim or restake the staking rewards once a week, if the protocol lets you.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Close and reopen a small position, or adjust the margin, once a week.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market and enter another, once a week.';
    return 'Make one real action a week: a deposit, a swap, a vote, or a claim inside the protocol.';
  }
  function farmPlan(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdFor(row);
    var gas = capital >= 150 ? 8 : 4;
    var extra = row.chains.length > 1 ? ' Repeat the deposit on ' + row.chains[1] + ' too, so the activity spans two chains.' : '';
    return [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(row, capital, chain) + extra, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(row) + ' Spread the actions across different days so the activity looks like real use, not one burst.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw anything, open the protocol's own points or rewards page from the link it publishes itself, and check your wallet's standing there.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet address, the dates and every transaction hash in a farm log, then plan the exit: unwind in two steps and keep $10 of gas in the wallet.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }

  // ---- stats ----
  var stats = document.getElementById('stats');
  var maxImplied = DATA.rows.length ? DATA.rows[0].implied_value_usd : 0;
  function stat(label, value, sub) {
    return el('div', null, el('dt', { text: label }), el('dd', null, document.createTextNode(value), sub ? el('small', { text: ' ' + sub }) : null));
  }
  stats.appendChild(stat('Board rows', String(DATA.board_size), DATA.early_size + ' early'));
  stats.appendChild(stat('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every one'));
  stats.appendChild(stat('Top implied value', fmtUsd(maxImplied), DATA.rows.length ? DATA.rows[0].name : ''));
  stats.appendChild(stat('Total implied value', fmtUsd(DATA.total_implied_usd), 'whole board'));
  stats.appendChild(stat('Snapshot date', DATA.as_of, 'frozen'));
  stats.appendChild(stat('Model', DATA.model_version, 'comparables'));

  // ---- filter controls ----
  var q = document.getElementById('q');
  var categorySel = document.getElementById('category');
  var chainSel = document.getElementById('chain');
  var sortSel = document.getElementById('sort');
  var watchlistBox = document.getElementById('watchlist');
  var countEl = document.getElementById('count');
  var rowsEl = document.getElementById('rows');

  var categories = {};
  var chains = {};
  DATA.rows.forEach(function (r) {
    if (r.category) categories[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(categories).sort().forEach(function (c) { categorySel.appendChild(el('option', { value: c, text: c })); });
  Object.keys(chains).sort().forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });

  function visibleRows() {
    var needle = state.q.trim().toLowerCase();
    var list = DATA.rows.filter(function (r) {
      if (state.watchlist && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (needle && r.name.toLowerCase().indexOf(needle) < 0 && r.slug.toLowerCase().indexOf(needle) < 0) return false;
      return true;
    });
    var sorted = list.slice();
    if (state.sort === 'tvl') sorted.sort(function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; });
    else if (state.sort === 'growth') sorted.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0) || a.rank - b.rank; });
    else if (state.sort === 'age') sorted.sort(function (a, b) { return (b.age_days || 0) - (a.age_days || 0) || a.rank - b.rank; });
    else sorted.sort(function (a, b) { return a.rank - b.rank; });
    return sorted;
  }

  function renderBoard() {
    var list = visibleRows();
    rowsEl.textContent = '';
    countEl.textContent = list.length + ' of ' + DATA.board_size + ' protocols shown' +
      (state.category !== 'all' ? ' in ' + state.category : '') +
      (state.watchlist ? ' (watchlist only)' : '') + '.';
    list.forEach(function (r) {
      var tr = el('tr', { class: r.rank <= 3 ? 'top3' : null });
      var pct = el('span', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      var nameCell = el('td', null,
        el('span', { class: 'pname', text: r.name }),
        r.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null,
        el('div', { class: 'pmeta', text: (r.category || 'Uncategorised') + ' · ' + r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') })
      );
      var valueCell = el('td', { class: 'num' },
        document.createTextNode(fmtUsd(r.implied_value_usd)),
        el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(2, Math.round(100 * r.implied_value_usd / maxImplied)) + '%' }))
      );
      tr.appendChild(el('td', { class: 'num', text: String(r.rank) }));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num' }, pct));
      tr.appendChild(el('td', { class: 'num', text: fmtAge(r.age_days) }));
      tr.appendChild(valueCell);
      tr.appendChild(el('td', null, el('button', { class: 'linklike', type: 'button', text: 'Farm plan', onclick: function () { openDetail(r.slug); } })));
      rowsEl.appendChild(tr);
    });
    if (list.length === 0) {
      rowsEl.appendChild(el('tr', null, el('td', { colspan: '7', text: 'No protocol matches this filter. Clear the search or pick another category.' })));
    }
  }

  // ---- live view ----
  var liveEl = document.getElementById('live-rows');
  DATA.live.forEach(function (p) {
    var tr = el('tr', null,
      el('td', null,
        el('span', { class: 'pname', text: p.name }),
        el('div', { class: 'pmeta', text: (p.category || 'Uncategorised') + ' · ' + p.chains.slice(0, 3).join(', ') })
      ),
      el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
      el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
      el('td', { class: 'num' }, el('span', { class: p.change_7d === null ? '' : (p.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(p.change_7d) }))
    );
    liveEl.appendChild(tr);
  });

  // ---- tabs ----
  var tabs = document.querySelectorAll('.tabs button');
  function showTab(name) {
    state.tab = name;
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('view-board').hidden = name !== 'board';
    document.getElementById('view-live').hidden = name !== 'live';
    document.getElementById('view-how').hidden = name !== 'how';
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });

  // ---- detail drawer ----
  var drawer = document.getElementById('drawer');
  var detail = document.getElementById('detail');
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    var recomputed = impliedOf(row);
    var matches = recomputed === row.implied_value_usd;
    var growth = clamp(row.change_7d === null ? 0 : row.change_7d, M.growth_floor, M.growth_cap);
    var growthMult = 1 + (growth / 100) * M.growth_weight;
    var age = row.age_days === null ? M.unknown_age_days : row.age_days;
    var tenure = M.tenure_floor + (clamp(age, 0, M.tenure_days) / M.tenure_days) * M.tenure_range;
    var breadth = 1 + M.breadth_step * Math.min(Math.max(row.chains.length - 1, 0), M.breadth_max_chains);
    detail.textContent = '';
    detail.appendChild(el('h2', { id: 'detail-title', text: '#' + row.rank + ' ' + row.name }));
    detail.appendChild(el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' · ' + row.chains.join(', ') + ' · listed ' + (row.listed_at || 'date unknown') }));
    var facts = el('dl', { class: 'facts' });
    function fact(label, value) { facts.appendChild(el('div', null, el('dt', { text: label }), el('dd', { text: value }))); }
    fact('TVL', fmtUsd(row.tvl_usd));
    fact('7-day change', fmtPct(row.change_7d));
    fact('Age', fmtAge(row.age_days));
    fact('Token', 'records no token');
    fact('Watchlist', row.watchlist ? 'yes — on the $50M floor list' : 'no — an early find below the floor');
    fact('Chains', String(row.chains.length));
    detail.appendChild(facts);
    var box = el('div', { class: 'modelbox' });
    box.appendChild(el('h3', { text: 'Why it is worth ' + fmtUsd(row.implied_value_usd) }));
    var mt = el('table', null);
    mt.appendChild(el('thead', null, el('tr', null, el('th', { text: 'Factor' }), el('th', { class: 'num', text: 'Value' }))));
    var mb = el('tbody', null);
    function mrow(label, value) { mb.appendChild(el('tr', null, el('td', { text: label }), el('td', { class: 'num', text: value }))); }
    mrow('TVL', fmtUsd(row.tvl_usd));
    mrow(row.comparable_group >= M.comp_min_group
      ? 'Comparable (' + (row.category || 'uncategorised') + ', ' + row.comparable_group + ' live peers)'
      : 'Comparable (global median — only ' + row.comparable_group + ' live peer' + (row.comparable_group === 1 ? '' : 's') + ' in ' + (row.category || 'this category') + ')',
      row.comparable_multiple.toFixed(2) + '×');
    mrow('Growth (' + fmtPct(row.change_7d) + ' over 7 days)', growthMult.toFixed(2) + '×');
    mrow('Tenure (' + fmtAge(row.age_days) + ' with no token)', tenure.toFixed(2) + '×');
    mrow('Breadth (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')', breadth.toFixed(2) + '×');
    mrow('Implied value (recomputed in this page)', fmtUsd(recomputed) + (matches ? ' — matches the board' : ' — differs from the board'));
    mt.appendChild(mb);
    box.appendChild(mt);
    detail.appendChild(box);
    detail.appendChild(el('h3', { text: 'Farm plan — six steps' }));
    var steps = el('ol', { class: 'steps' });
    farmPlan(row).forEach(function (s) {
      steps.appendChild(el('li', null, document.createTextNode(s.text), el('span', { class: 'cost', text: 'Cost: ' + s.cost + '. Time: ' + s.time + '.' })));
    });
    detail.appendChild(steps);
    detail.appendChild(el('p', { class: 'warn', text: 'This protocol records no token in the snapshot. That is the record, not proof: check the protocol’s own pages before you farm, and never pay anyone to claim an airdrop for you.' }));
    drawer.hidden = false;
    document.getElementById('close-detail').focus();
  }
  function closeDetail() {
    drawer.hidden = true;
    state.selected = null;
    if (window.location.hash.indexOf('#/protocol/') === 0) window.history.replaceState(null, '', '#');
  }
  document.getElementById('close-detail').addEventListener('click', closeDetail);
  drawer.addEventListener('click', function (e) { if (e.target === drawer) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) closeDetail(); });

  // ---- controls ----
  q.addEventListener('input', function () { state.q = q.value; renderBoard(); });
  categorySel.addEventListener('change', function () { state.category = categorySel.value; renderBoard(); });
  chainSel.addEventListener('change', function () { state.chain = chainSel.value; renderBoard(); });
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; renderBoard(); });
  watchlistBox.addEventListener('change', function () { state.watchlist = watchlistBox.checked; renderBoard(); });

  // Deep links, so a screenshot can open a state directly: #/protocol/<slug> opens the
  // detail view, #/filter/<category> filters the board to that category.
  function applyHash() {
    var h = window.location.hash;
    if (h.indexOf('#/protocol/') === 0) {
      showTab('board');
      openDetail(decodeURIComponent(h.slice(11)));
    } else {
      if (!drawer.hidden) { drawer.hidden = true; state.selected = null; }
      if (h.indexOf('#/filter/') === 0) {
        var cat = decodeURIComponent(h.slice(9));
        if (categorySel.querySelector('option[value="' + cat + '"]')) {
          categorySel.value = cat;
          state.category = cat;
        }
        showTab('board');
        renderBoard();
      }
    }
  }
  window.addEventListener('hashchange', applyHash);

  renderBoard();
  applyHash();
  app.setAttribute('aria-busy', 'false');
})();
