package internal

import (
	"fmt"
	"net/mail"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

func RegisterEmailInvitation(pb *pocketbase.PocketBase) error {
	pb.OnRecordAfterCreateSuccess("site_role_assignments").BindFunc(func(event *core.RecordEvent) error {
		if event.App.Settings().SMTP.Enabled {
			if err := sendInvitation(event.App, event.Record); err != nil {
				event.App.Logger().Error(err.Error())
			}
		}
		return event.Next()
	})

	return nil
}

func sendInvitation(app core.App, roleAssignment *core.Record) error {
	siteId := roleAssignment.GetString("site")
	site, err := app.FindRecordById("sites", siteId)
	if err != nil {
		return err
	}

	userId := roleAssignment.GetString("user")
	user, err := app.FindRecordById("users", userId)
	if err != nil {
		return err
	}

	var html string
	if user.Get("invite") == "pending" {
		passwordResetToken, err := user.NewPasswordResetToken()
		if err != nil {
			return err
		}

		html = fmt.Sprintf(
			"<p>You've been invited to collaborate on %s. Click the link below to create your password.</p>\n<p>\n"+
				"<a href=\"%s/admin/auth?create=%s&email=%s\" target=\"_blank\" rel=\"noopener\">Create password</a>\n</p>",
			site.GetString("name"),
			"https://"+site.GetString("host"),
			passwordResetToken,
			user.Email(),
		)
	} else {
		html = fmt.Sprintf(
			"<p>You've been invited to collaborate on %[1]s. Below you can find the address for editing the site.</p>\n<p>\n"+
				"<a href=\"%[2]s/admin\" target=\"_blank\" rel=\"noopener\">%[2]s/admin</a>\n</p>",
			site.GetString("name"),
			"https://"+site.GetString("host"),
		)
	}

	meta := app.Settings().Meta
	message := &mailer.Message{
		From: mail.Address{
			Address: meta.SenderAddress,
			Name:    meta.SenderName,
		},
		To: []mail.Address{{
			Address: user.Email(),
		}},
		Subject: fmt.Sprintf("You've been invited to collaborate on %s", site.GetString("name")),
		HTML:    html,
	}

	if err := app.NewMailClient().Send(message); err != nil {
		return err
	}

	if user.Get("invite") == "pending" {
		user.Set("invite", "sent")
		if err := app.Save(user); err != nil {
			return err
		}
	}

	return nil
}
