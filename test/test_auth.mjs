import { createSessionCookie, getSessionUser, clearSessionCookie, checkCredentials } from "../src/auth.js";

let failed = 0;
function check(desc, cond) {
  console.log(`[${cond ? "OK" : "FAIL"}] ${desc}`);
  if (!cond) failed++;
}

const SECRET = "test-secret-abc123";

function fakeRequest(cookieHeader) {
  return { headers: { get: (name) => (name === "Cookie" ? cookieHeader : null) } };
}

const cookieHeaderStr = await createSessionCookie("adam", SECRET);
check("createSessionCookie zwraca ciasteczko HttpOnly", cookieHeaderStr.includes("HttpOnly"));
const cookieValue = cookieHeaderStr.split(";")[0]; // "panel_session=..."

const req = fakeRequest(cookieValue);
const user = await getSessionUser(req, SECRET);
check("getSessionUser odczytuje poprawnego uzytkownika z podpisanego ciasteczka", user === "adam");

const reqBadSecret = fakeRequest(cookieValue);
const userBadSecret = await getSessionUser(reqBadSecret, "inny-secret");
check("getSessionUser odrzuca zle podpisane ciasteczko (zly sekret)", userBadSecret === null);

const tamperedValue = cookieValue.slice(0, -2) + "xx";
const reqTampered = fakeRequest(tamperedValue);
const userTampered = await getSessionUser(reqTampered, SECRET);
check("getSessionUser odrzuca zmanipulowane ciasteczko", userTampered === null);

const reqNoCookie = fakeRequest("");
check("getSessionUser bez ciasteczka -> null", (await getSessionUser(reqNoCookie, SECRET)) === null);

check("clearSessionCookie ustawia Max-Age=0", clearSessionCookie().includes("Max-Age=0"));

const settings = { basicAuth: { username: "admin", password: "haslo123" } };
check("checkCredentials: poprawne dane -> true", checkCredentials("admin", "haslo123", settings));
check("checkCredentials: zle haslo -> false", !checkCredentials("admin", "zle", settings));
check("checkCredentials: zly login -> false", !checkCredentials("kto", "haslo123", settings));
check("checkCredentials: puste dane -> false", !checkCredentials("", "", settings));

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
