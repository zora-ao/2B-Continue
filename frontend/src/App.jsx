import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function App() {
  const [status, setStatus] = useState("checking…");
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.health()
      .then((d) => setStatus(d.status))
      .catch(() => setStatus("offline"));
    api.listItems().then(setItems).catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const item = await api.createItem(text);
      setItems((prev) => [...prev, item]);
      setText("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="container">
      <h1>2B Continue</h1>
      <p>
        Backend status:{" "}
        <span className={status === "ok" ? "ok" : "bad"}>{status}</span>
      </p>

      <form onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item"
        />
        <button type="submit">Add</button>
      </form>
      {error && <p className="bad">{error}</p>}

      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </main>
  );
}
