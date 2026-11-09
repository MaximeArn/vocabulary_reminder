import { useState } from "react";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { InstallHint } from "../../pwa/InstallHint";
import { signIn } from "../../sync/service";
import styles from "./LoginScreen.module.css";

const ICON = `${import.meta.env.BASE_URL}icons/icon-512.png`;

/** Écran d'accueil d'un appareil sans compte ouvert. */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // Le service bascule l'app dès que la session est ouverte.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La connexion a échoué.");
      setBusy(false);
    }
  };

  return (
    <main className={styles.screen}>
      <div className={styles.brand}>
        <img className={styles.icon} src={ICON} alt="" />
        <h1 className={styles.name}>Mnémé</h1>
        <p className={styles.tagline}>Ce que tu lis, tu le retiens.</p>
      </div>

      <InstallHint />

      {/* Un vrai formulaire : le trousseau iCloud propose d'enregistrer puis de remplir le mot de passe. */}
      <form className={styles.form} onSubmit={submit}>
        <TextField label="E-mail" type="email" name="email" autoComplete="username" autoCapitalize="off" value={email} onChange={setEmail} />
        <TextField
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          autoCapitalize="off"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={busy || email.trim() === "" || password === ""}>
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <p className={styles.note}>Une seule connexion par appareil : l’app s’ouvre ensuite directement, même hors ligne.</p>
    </main>
  );
}
