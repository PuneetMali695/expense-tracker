// ---------- Grab elements ----------
const form = document.getElementById("form");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const list = document.getElementById("list");
const emptyMsg = document.getElementById("empty");
const filter = document.getElementById("filter");
const clearAll = document.getElementById("clearAll");

const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const savingsEl = document.getElementById("savings");

// ---------- Data (saved in browser's localStorage) ----------
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

function save() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

// ---------- Add a transaction ----------
form.addEventListener("submit", function (e) {
  e.preventDefault();

  const transaction = {
    id: Date.now(),
    title: titleInput.value.trim(),
    amount: parseFloat(amountInput.value),
    type: typeInput.value,
    category: categoryInput.value,
    date: dateInput.value
  };

  transactions.unshift(transaction); // newest first
  save();
  render();
  
  alert("Transaction added successfully!"); 

  form.reset();
  dateInput.value = today();
});

// ---------- Delete one transaction ----------
function deleteTransaction(id) {
  transactions = transactions.filter(function (t) {
    return t.id !== id;
  });
  save();
  render();
}

// ---------- Clear everything ----------
clearAll.addEventListener("click", function () {
  if (transactions.length === 0) return;
  if (confirm("Delete all transactions? This cannot be undone.")) {
    transactions = [];
    save();
    render();
  }
});

filter.addEventListener("change", render);

// ---------- Charts ----------
let pieChart, barChart;

function updateChart() {
  // 1. Totals: income, expense, and expense per category
  let income = 0;
  let expense = 0;
  const totals = {};
  transactions.forEach(function (t) {
    if (t.type === "income") {
      income += t.amount;
    } else {
      expense += t.amount;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
  });

  // 2. Doughnut chart (with percentages in the labels)
  const names = Object.keys(totals);
  const hasData = names.length > 0;
  document.getElementById("pieBox").style.display = hasData ? "block" : "none";
  document.getElementById("noChart").style.display = hasData ? "none" : "block";

  if (pieChart) pieChart.destroy();
  if (hasData) {
    const labels = names.map(function (n) {
      return n + " (" + ((totals[n] / expense) * 100).toFixed(1) + "%)";
    });
    pieChart = new Chart(document.getElementById("pieChart"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: Object.values(totals),
          backgroundColor: ["#0f766e", "#c2410c", "#7c3aed", "#d97706", "#2563eb", "#db2777"]
        }]
      },
      options: { plugins: { legend: { position: "bottom" } } }
    });
  }

  // 3. Bar chart: income vs expenses
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: ["All transactions"],
      datasets: [
        { label: "Income", data: [income], backgroundColor: "#15803d" },
        { label: "Expenses", data: [expense], backgroundColor: "#c2410c" }
      ]
    },
    options: {
		 aspectRatio: 1,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ---------- Show everything on screen ----------
function render() {
  // 1. Totals
  let income = 0;
  let expense = 0;
  transactions.forEach(function (t) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });
  incomeEl.textContent = money(income);
  expenseEl.textContent = money(expense);
  balanceEl.textContent = money(income - expense);

  // Savings rate = (income - expense) / income * 100
  const rate = income > 0 ? ((income - expense) / income) * 100 : 0;
  savingsEl.textContent = rate.toFixed(1) + "%";

  // 2. List (apply filter)
  const shown = transactions.filter(function (t) {
    return filter.value === "all" || t.type === filter.value;
  });

  list.innerHTML = "";
  emptyMsg.style.display = shown.length === 0 ? "block" : "none";

  shown.forEach(function (t) {
    const li = document.createElement("li");
    const sign = t.type === "income" ? "+" : "-";

    // textContent is used for the title to avoid HTML injection
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("strong");
    name.textContent = t.title;
    const meta = document.createElement("small");
    meta.textContent = t.category + " • " + t.date;
    info.append(name, meta);

    const amt = document.createElement("span");
    amt.className = "amt " + t.type;
    amt.textContent = sign + money(t.amount);

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "Delete";
    del.addEventListener("click", function () {
      deleteTransaction(t.id);
    });

    li.append(info, amt, del);
    list.appendChild(li);
  });

  // 3. Redraw the charts
  updateChart();
}

// ---------- Start ----------
function today() {
  return new Date().toISOString().split("T")[0];
}

dateInput.value = today();
render();

function money(amount) {
    return "₹" + amount.toFixed(2);
}