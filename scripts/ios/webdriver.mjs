// Client WebDriver minimal pour piloter Safari dans le simulateur iOS.
// safaridriver est fourni par macOS : aucune dépendance à installer.

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

export class IosSafari {
  constructor(driverUrl) {
    this.driverUrl = driverUrl;
    this.sessionUrl = null;
  }

  async request(method, path, body) {
    const response = await fetch(`${this.sessionUrl ?? this.driverUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(`${method} ${path} : ${json.value?.message ?? response.status}`);
    return json.value;
  }

  async start() {
    const value = await this.request("POST", "/session", {
      capabilities: {
        alwaysMatch: { browserName: "safari", platformName: "iOS", "safari:useSimulator": true },
      },
    });
    this.sessionUrl = `${this.driverUrl}/session/${value.sessionId}`;
    return value.capabilities;
  }

  async stop() {
    if (this.sessionUrl) await this.request("DELETE", "");
    this.sessionUrl = null;
  }

  open(url) {
    return this.request("POST", "/url", { url });
  }

  async find(css) {
    const value = await this.request("POST", "/element", { using: "css selector", value: css });
    return value[ELEMENT_KEY];
  }

  async findAll(css) {
    const values = await this.request("POST", "/elements", { using: "css selector", value: css });
    return values.map((value) => value[ELEMENT_KEY]);
  }

  /** Premier bouton dont le texte (ou aria-label) correspond exactement. */
  async button(label) {
    const id = await this.script(
      `return [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent.trim()) === arguments[0] && !b.disabled) ?? null;`,
      [label],
    );
    if (!id) throw new Error(`Bouton « ${label} » introuvable`);
    return id[ELEMENT_KEY];
  }

  /**
   * Clic déclenché en JavaScript.
   * Sur le simulateur iOS 26.5, le « tap » natif de safaridriver ne relâche jamais
   * le doigt (touchstart sans touchend, même sur une page vide) : on ne peut donc
   * pas s'y fier. Le gestionnaire de l'app reçoit bien un vrai événement click.
   */
  click(element) {
    return this.script("arguments[0].click();", [{ [ELEMENT_KEY]: element }]);
  }

  async clickButton(label) {
    await this.click(await this.button(label));
  }

  /**
   * Saisie déclenchée en JavaScript.
   * Sur le simulateur iOS 26.5, la saisie native de safaridriver donne le focus
   * au champ sans y écrire. On utilise le « setter » natif de `value` puis un
   * événement `input`, ce que React interprète comme une vraie saisie.
   */
  type(element, text) {
    return this.script(
      `const field = arguments[0];
       const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
       Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, field.value + arguments[1]);
       field.dispatchEvent(new Event("input", { bubbles: true }));`,
      [{ [ELEMENT_KEY]: element }, text],
    );
  }

  clear(element) {
    return this.script(
      `const field = arguments[0];
       const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
       Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, "");
       field.dispatchEvent(new Event("input", { bubbles: true }));`,
      [{ [ELEMENT_KEY]: element }],
    );
  }

  script(source, args = []) {
    return this.request("POST", "/execute/sync", { script: source, args });
  }

  /** Script asynchrone : il doit appeler `done(résultat)` (dernier argument). */
  scriptAsync(source, args = []) {
    return this.request("POST", "/execute/async", {
      script: `const done = arguments[arguments.length - 1]; ${source}`,
      args,
    });
  }

  bodyText() {
    return this.script("return document.body.innerText;");
  }

  acceptAlert() {
    return this.request("POST", "/alert/accept", {});
  }

  /** Attend qu'une condition devienne vraie (l'interface est asynchrone). */
  async waitFor(description, condition, timeoutMs = 4000) {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < timeoutMs) {
      try {
        if (await condition()) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Délai dépassé : ${description}${lastError ? ` (${lastError.message})` : ""}`);
  }

  /** Attend qu'un texte apparaisse dans la page. */
  waitForText(text, timeoutMs) {
    return this.waitFor(`texte « ${text} »`, async () => (await this.bodyText()).includes(text), timeoutMs);
  }

  waitForNoText(text, timeoutMs) {
    return this.waitFor(`disparition de « ${text} »`, async () => !(await this.bodyText()).includes(text), timeoutMs);
  }
}
