import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
 
// =====================================================================
// CONNECT TO SUPABASE
// The URL and key come from .env.local (or Vercel's settings later).
// Both values are public by design. NEVER put your secret key here.
// =====================================================================
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
 
// Each category has its own color, set in index.css (.cat-meals, .cat-travel, ...)
const CATEGORIES = ["Meals", "Travel", "Supplies", "Software", "Other"];
const money = (n) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const catClass = (name) => "cat-" + name.toLowerCase();
 
// Today's date as YYYY-MM-DD, for the date box
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
 
// "2026-11-22" -> "Nov 22, 2026" (or "Nov 22" without the year)
function niceDate(isoDate, withYear = true) {
  const options = withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" };
  return new Date(isoDate + "T00:00").toLocaleDateString("en-US", options);
}
 
// The last n days as YYYY-MM-DD, oldest first, for the daily chart
function lastDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
 
export default function App() {
  // ---------- STATE: what the page remembers ----------
  const [expenses, setExpenses] = useState([]); // rows the database sends back
  const [status, setStatus] = useState("Loading expenses...");
  const [spentOn, setSpentOn] = useState(today());
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Meals");
  const [amount, setAmount] = useState("");
 
  // ---------- READ: ask the database for the expenses ----------
  async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
 
    if (error) {
      setExpenses([]);
      setStatus("Couldn't load expenses: " + error.message);
      return;
    }
    setExpenses(data);
    setStatus(data.length === 0 ? "No expenses yet. Add your first one below." : "");
  }
 
  // Load the expenses once, when the page opens
  useEffect(() => {
    if (supabase) loadExpenses();
  }, []);
 
  // ---------- WRITE: add an expense ----------
  async function addExpense(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setStatus("Saving...");
    const { error } = await supabase
      .from("expenses")
      .insert({ spent_on: spentOn, vendor: vendor.trim(), category, amount: Number(amount) });
 
    if (error) {
      setStatus("Couldn't save: " + error.message);
      return;
    }
    setVendor("");
    setAmount("");
    loadExpenses();
  }
 
  // ---------- DASHBOARD MATH: everything below comes from the rows we got back ----------
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const average = expenses.length ? total / expenses.length : 0;
  const byCategory = CATEGORIES.map((c) => ({
    name: c,
    amount: expenses.filter((e) => e.category === c).reduce((sum, e) => sum + Number(e.amount), 0),
  }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount); // biggest first
  const biggest = byCategory[0];
  const days = lastDays(14).map((day) => ({
    day,
    amount: expenses.filter((e) => e.spent_on === day).reduce((sum, e) => sum + Number(e.amount), 0),
  }));
  const busiestDay = Math.max(...days.map((d) => d.amount), 1);
 
  // ---------- Shown if .env.local is missing ----------
  if (!supabase) {
    return (
      <main className="wrap">
        <h1>Expense Tracker</h1>
        <p className="status error">
          Not connected to Supabase yet. Check your .env.local file, then stop and restart npm run dev.
        </p>
      </main>
    );
  }
 
  // ---------- What the page shows ----------
  return (
    <main className="wrap">
      <header className="top">
        <span className="logo" aria-hidden="true">$</span>
        <div>
          <h1>Expense Tracker</h1>
          <p className="intro">Log what you spend and see where your money goes.</p>
        </div>
      </header>
 
      <>
          {/* ---------- KPI tiles: the headline numbers ---------- */}
          <section className="kpis">
            <div className="card kpi hero">
              <span className="label">Total spent</span>
              <strong className="value">{money(total)}</strong>
              <span className="sub">{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</span>
            </div>
            <div className="card kpi">
              <span className="label">Average expense</span>
              <strong className="value">{money(average)}</strong>
            </div>
            <div className="card kpi">
              <span className="label">Biggest category</span>
              <strong className="value">{biggest ? biggest.name : "None yet"}</strong>
              {biggest && <span className="sub">{money(biggest.amount)}</span>}
            </div>
          </section>
 
          <div className="charts">
            {/* ---------- Where the money goes: one bar split by category ---------- */}
            <section className="card">
              <h2>Where your money goes</h2>
              <div className="split" role="img" aria-label="Spending by category">
                {byCategory.length === 0 && <span className="empty-bar"></span>}
                {byCategory.map((c) => (
                  <span key={c.name} className={"seg " + catClass(c.name)} style={{ flexGrow: c.amount }} title={c.name + ": " + money(c.amount)}>
                    {c.amount / total >= 0.12 ? Math.round((c.amount / total) * 100) + "%" : ""}
                  </span>
                ))}
              </div>
              <ul className="legend">
                {byCategory.map((c) => (
                  <li key={c.name}>
                    <span className={"swatch " + catClass(c.name)}></span>
                    <span className="name">{c.name}</span>
                    <span className="amt">{money(c.amount)}</span>
                    <span className="pct">{Math.round((c.amount / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </section>
 
            {/* ---------- Spending per day for the last two weeks ---------- */}
            <section className="card">
              <h2>Last 14 days</h2>
              <div className="days">
                {days.map((d) => (
                  <div key={d.day} className="day" title={niceDate(d.day) + ": " + money(d.amount)}>
                    <i style={{ height: d.amount ? Math.max((d.amount / busiestDay) * 100, 3) + "%" : 0 }}></i>
                  </div>
                ))}
              </div>
              <div className="axis">
                <span>{niceDate(days[0].day, false)}</span>
                <span>Today</span>
              </div>
            </section>
          </div>
 
          {/* ---------- Add an expense ---------- */}
          <form className="card" onSubmit={addExpense}>
            <h2>Add an expense</h2>
            <div className="fields">
              <div>
                <label htmlFor="spent-on">Date</label>
                <input id="spent-on" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
              </div>
              <div className="grow">
                <label htmlFor="vendor">Vendor</label>
                <input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} required maxLength={80} placeholder="Where did you spend it?" />
              </div>
              <div>
                <label htmlFor="category">Category</label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="amount">Amount ($)</label>
                <input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <button type="submit">Add expense</button>
          </form>
 
          {status && <p className="status">{status}</p>}
 
          {/* ---------- Every expense, newest first ---------- */}
          {expenses.length > 0 && (
            <section className="card table-card">
              <h2>All expenses</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="date">{niceDate(e.spent_on)}</td>
                        <td className="vendor">{e.vendor}</td>
                        <td className="cat">
                          <span className="chip">
                            <span className={"swatch " + catClass(e.category)}></span>
                            {e.category}
                          </span>
                        </td>
                        <td className="num amount">{money(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
      </>
    </main>
  );
}