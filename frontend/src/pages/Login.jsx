import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Msg } from '../components/ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const [f, setF] = React.useState({ username: '', password: '' });
  const [err, setErr] = React.useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { const r = await api.post('/auth/login', f); localStorage.setItem('jn_token', r.token); localStorage.setItem('jn_user', JSON.stringify(r.user)); nav('/'); }
    catch (x) { setErr(x.message); }
  };
  return (<>
    <div className="tri" />
    <main className="login"><section className="card">
      <h2 className="pt"><span lang="mr">जलनीती</span> JalNiti AI</h2>
      <p className="sub">Sign in with your operator or administrator account.</p>
      <Msg kind="err">{err}</Msg>
      <form onSubmit={submit}>
        <div className="fld"><label htmlFor="u">Username</label><input id="u" autoComplete="username" required value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></div>
        <div className="fld"><label htmlFor="p">Password</label><input id="p" type="password" autoComplete="current-password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn" type="submit">Sign in</button>
      </form>
      <p className="sub" style={{ marginTop: 14 }}>Prototype only. Demo accounts are listed in the README.</p>
    </section></main></>);
}
