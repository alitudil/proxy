import { Router } from "express";
import { UserPartialSchema } from "../../shared/users/schema";
import * as userStore from "../../shared/users/user-store";
import { ForbiddenError, UserInputError } from "../../shared/errors";
import { sanitizeAndTrim } from "../../shared/utils";
import { config } from "../../config";

const router = Router();

router.use((req, res, next) => {
  if (req.session.userToken) {
    res.locals.currentSelfServiceUser =
      userStore.getUser(req.session.userToken) || null;
  }
  next();
});

router.get("/", (_req, res) => {
  res.redirect("/");
});

router.get("/lookup", (_req, res) => {
  res.render("user_lookup", { user: res.locals.currentSelfServiceUser });
});

router.post("/lookup", (req, res) => {
  const token = req.body.token;
  const user = userStore.getUser(token);
  if (!user) {
    req.session.flash = { type: "error", message: "Invalid user token." };
    return res.redirect("/user/lookup");
  }
  req.session.userToken = user.token;
  return res.redirect("/user/lookup");
});

router.post("/edit-nickname", (req, res) => {
  const existing = res.locals.currentSelfServiceUser;

  if (!existing) {
    throw new ForbiddenError("Not logged in.");
  } else if (!config.allowNicknameChanges || existing.disabledAt) {
    throw new ForbiddenError("Nickname changes are not allowed.");
  }

  const schema = UserPartialSchema.pick({ nickname: true })
    .strict()
    .transform((v) => ({ nickname: sanitizeAndTrim(v.nickname) }));

  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new UserInputError(result.error.message);
  }

  const newNickname = result.data.nickname || null;
  userStore.upsertUser({ token: existing.token, nickname: newNickname });
  req.session.flash = { type: "success", message: "Nickname updated." };
  return res.redirect("/user/lookup");
});

export { router as selfServiceRouter };