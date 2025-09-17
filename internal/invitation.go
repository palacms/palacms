package internal

import (
	"fmt"
	"net/mail"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

func RegisterEmailInvitation(pb *pocketbase.PocketBase) error {
	pb.OnRecordAfterCreateSuccess("users").BindFunc(func(event *core.RecordEvent) error {
		if event.Record.Get("invite") == "pending" {
			if err := sendInvitation(event); err != nil {
				event.App.Logger().Error(err.Error())
			}
		}
		return event.Next()
	})

	pb.OnRecordAfterUpdateSuccess("users").BindFunc(func(event *core.RecordEvent) error {
		if event.Record.Get("invite") == "pending" {
			if err := sendInvitation(event); err != nil {
				event.App.Logger().Error(err.Error())
			}
		}
		return event.Next()
	})

	return nil
}

func sendInvitation(event *core.RecordEvent) error {
	meta := event.App.Settings().Meta
	token, err := event.Record.NewPasswordResetToken()
	if err != nil {
		return err
	}

	message := &mailer.Message{
		From: mail.Address{
			Address: meta.SenderAddress,
			Name:    meta.SenderName,
		},
		To: []mail.Address{{
			Address: event.Record.Email(),
		}},
		Subject: fmt.Sprintf("You've been invited to collaborate on %s", meta.AppName),
		HTML: fmt.Sprintf(
			"<p>You've been invited to collaborate on %s. Click the link below to create your password.</p>\n<p>\n"+
				"<a href=\"%s/admin/auth?create=%s\" target=\"_blank\" rel=\"noopener\">Create password</a>\n</p>",
			meta.AppName,
			meta.AppURL,
			token,
		),
	}

	if err := event.App.NewMailClient().Send(message); err != nil {
		return err
	}

	event.Record.Set("invite", "sent")
	if err := event.App.Save(event.Record); err != nil {
		return err
	}

	return nil
}
