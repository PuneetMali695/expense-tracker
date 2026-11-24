const $ = id => document.getElementById(id);
const BASE_CATS = ["Food", "Travel", "Shopping", "Bills", "Entertainment", "Salary", "Others"];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const curMonth = today().slice(0, 7);
const money = n => `${n < 0 ? "-" : ""}₹${Math.abs(n).toFixed(2)}`;
const fmtMonth = ym => ym === "all"
  ? "All Months"
  : new Date(...ym.split("-").map((v, i) => i ? v - 1 : +v), 1)
      .toLocaleDateString("en-US", { month: "short", year: "numeric" }) + (ym === curMonth ? " (Current)" : "");

let transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
let selectedMonth = curMonth;
let pieChart, barChart;

const save = () => localStorage.setItem("transactions", JSON.stringify(transactions));

$("date").value = today();

// Dynamic custom category input for "Others"
$("category").addEventListener("change", () => {
  const isOthers = $("category").value === "Others";
  $("customCat").hidden = !isOthers;

  if (isOthers) $("customCat").focus();
  else $("customCat").value = "";
});

// Add transaction
$("form").addEventListener("submit", e => {
  e.preventDefault();
  const cat = $("category").value === "Others" ? ($("customCat").value.trim() || "Others") : $("category").value;
  transactions.unshift({
    id: Date.now(),
    title: $("title").value.trim(),
    amount: parseFloat($("amount").value),
    type: $("type").value,
    category: cat,
    date: $("date").value
  });
  selectedMonth = $("date").value.slice(0, 7);
  save();
  $("form").reset();
  $("customCat").hidden = true;
  $("customCat").required = false;
  $("date").value = today();
  render();
});

// Month selector, search, filter & sort
$("monthSelect").addEventListener("change", e => { selectedMonth = e.target.value; render(); });
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);
$("sort").addEventListener("change", render);

// Clear all
$("clearAll").addEventListener("click", () => {
  if (transactions.length && confirm("Delete all transactions? This cannot be undone.")) {
    transactions = [];
    save();
    render();
  }
});

// CSV export
$("exportCsv").addEventListener("click", () => {
  const rows = (selectedMonth === "all" ? transactions : transactions.filter(t => t.date.startsWith(selectedMonth)))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (!rows.length) return alert("No transactions to export for this period.");
  let runningBalance = 0;
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ["Date,Title,Category,Type,Amount,Balance", ...rows.map(t => {
    runningBalance += t.type === "income" ? t.amount : -t.amount;
    return [t.date, t.title, t.category, t.type, t.amount.toFixed(2), runningBalance.toFixed(2)].map(esc).join(",");
  })].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
    download: `expenses-${selectedMonth}.csv`
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

const barPctPlugin = {
  id: "barPct",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1c2b2a";
    chart.data.datasets.forEach((ds, i) => {
      const bar = chart.getDatasetMeta(i).data[0];
      if (bar) ctx.fillText(`${ds.pct}%`, bar.x, bar.y - 6);
    });
    ctx.restore();
  }
};

function updateCharts(items, income, expense) {
  const totals = {};
  items.forEach(t => { if (t.type === "expense") totals[t.category] = (totals[t.category] || 0) + t.amount; });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const hasPie = sorted.length > 0;

  $("pieBox").hidden = !hasPie;
  $("noChart").hidden = hasPie;
  $("topCat").hidden = !hasPie;

  if (pieChart) pieChart.destroy();
  if (hasPie) {
    $("topCat").textContent = `Top: ${sorted[0][0]} (${((sorted[0][1] / expense) * 100).toFixed(0)}%)`;
    pieChart = new Chart($("pieChart"), {
      type: "doughnut",
      data: {
        labels: sorted.map(([k, v]) => `${k} (${((v / expense) * 100).toFixed(1)}%)`),
        datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: ["#0f766e", "#c2410c", "#7c3aed", "#d97706", "#2563eb", "#db2777", "#059669"] }]
      },
      options: { plugins: { legend: { position: "bottom" } } }
    });
  }

  const total = income + expense;
  const incPct = total ? ((income / total) * 100).toFixed(1) : "0.0";
  const expPct = total ? ((expense / total) * 100).toFixed(1) : "0.0";

  if (barChart) barChart.destroy();
  barChart = new Chart($("barChart"), {
    type: "bar",
    data: {
      labels: [fmtMonth(selectedMonth)],
      datasets: [
        { label: `Income (${incPct}%)`, data: [income], backgroundColor: "#15803d", pct: incPct },
        { label: `Expenses (${expPct}%)`, data: [expense], backgroundColor: "#c2410c", pct: expPct }
      ]
    },
    options: {
      aspectRatio: 1,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true, grace: "15%" } }
    },
    plugins: [barPctPlugin]
  });
}

function render() {
  // Populate month dropdown (All Months + recorded months + current/selected)
  const months = [...new Set([curMonth, ...transactions.map(t => t.date.slice(0, 7)), ...(selectedMonth === "all" ? [] : [selectedMonth])])].sort().reverse();
  $("monthSelect").innerHTML = `<option value="all">All Months</option>` + months.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join("");
  $("monthSelect").value = selectedMonth;

   // Sync Add-Transaction category dropdown (base + user's custom categories grouped)
  const prevCat = $("category").value;
  const customCats = [...new Set(
    transactions
      .map(t => t.category)
      .filter(c => c && c !== "Income" && !BASE_CATS.includes(c))
  )];
  $("category").innerHTML = `<option value="" disabled selected>Select Category</option>`;
  BASE_CATS.forEach(c => $("category").appendChild(new Option(c, c)));
  if (customCats.length) {
    const grp = document.createElement("optgroup");
    grp.label = "Custom (Others)";
    customCats.forEach(c => grp.appendChild(new Option(c, c)));
    $("category").appendChild(grp);
  }
  const validCats = [...BASE_CATS, ...customCats];
  $("category").value = validCats.includes(prevCat) ? prevCat : "";

  // Sync category filter options (preserving selection if still valid)
  const prevFilter = $("filter").value;
  const allCats = [...new Set([...BASE_CATS.filter(c => c !== "Others"), ...customCats])];
  $("filterCats").innerHTML = "";
  allCats.forEach(c => $("filterCats").appendChild(new Option(c, `cat:${c}`)));
  $("filter").value = [...$("filter").options].some(o => o.value === prevFilter) ? prevFilter : "all";

  // Monthly slice & KPIs
  const monthTx = selectedMonth === "all" ? transactions : transactions.filter(t => t.date.startsWith(selectedMonth));
  let income = 0, expense = 0;
  monthTx.forEach(t => (t.type === "income" ? (income += t.amount) : (expense += t.amount)));
  const bal = income - expense;
  const rate = income > 0 ? (bal / income) * 100 : 0;

  $("income").textContent = money(income);
  $("expense").textContent = money(expense);
  $("balance").textContent = money(bal);
  $("balanceBadge").textContent = bal >= 0 ? "Surplus" : "Deficit";
  $("balanceBadge").className = `badge ${bal >= 0 ? "surplus" : "deficit"}`;
  $("savings").textContent = `${rate.toFixed(1)}%`;
  $("savingsBar").style.width = `${Math.max(0, Math.min(100, rate))}%`;

  // Filter, search & sort history
  const q = $("search").value.trim().toLowerCase();
  const f = $("filter").value;
  let shown = monthTx.filter(t => {
    const matchF = f === "all" || (f.startsWith("type:") ? t.type === f.slice(5) : t.category === f.slice(4));
    const matchQ = !q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    return matchF && matchQ;
  });
  const sortOrder = $("sort").value;
  if (sortOrder === "asc") shown.sort((a, b) => a.amount - b.amount);
  else if (sortOrder === "desc") shown.sort((a, b) => b.amount - a.amount);

  $("list").innerHTML = "";
  $("empty").hidden = shown.length > 0;
  shown.forEach(t => {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("strong");
    name.textContent = t.title;
    const cat = document.createElement("span");
    cat.className = "cat-box";
    cat.textContent = t.category;
    const dt = document.createElement("small");
    dt.textContent = t.date;
    info.append(name, cat, dt);

    const amt = document.createElement("span");
    amt.className = `amt ${t.type}`;
    amt.textContent = `${t.type === "income" ? "+" : "-"}${money(t.amount)}`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "Delete";
    del.onclick = () => { transactions = transactions.filter(x => x.id !== t.id); save(); render(); };

    li.append(info, amt, del);
    $("list").appendChild(li);
  });

  updateCharts(monthTx, income, expense);
}

render();
