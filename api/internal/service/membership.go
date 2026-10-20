package service

import (
	"errors"

	"github.com/bolao-app/api/internal/models"
)

const (
	JoinByCode       = "code"
	JoinByInviteLink = "invite_link"
	JoinFromListing  = "listing"
)

const (
	ActionEditSettings   = "edit_settings"
	ActionFinish         = "finish"
	ActionChangeRole     = "change_role"
	ActionReviewRequests = "review_requests"
	ActionRemoveMember   = "remove_member"
	ActionEditPayments   = "edit_payments"
	ActionInvite         = "invite"
)

var (
	ErrBolaoNotPublic    = errors.New("este bolão não é público")
	ErrBolaoFull         = errors.New("este bolão já tem o número máximo de participantes")
	ErrBolaoFinished     = errors.New("este bolão já terminou")
	ErrAlreadyMember     = errors.New("você já participa deste bolão")
	ErrAlreadyRequested  = errors.New("seu pedido para entrar já está aguardando aprovação")
	ErrForbidden         = errors.New("você não tem permissão para isso")
	ErrOwnerMustTransfer = errors.New("passe o bolão para outra pessoa antes de sair")
	ErrInvalidRole       = errors.New("papel inválido")
)

type JoinTarget struct {
	Active           bool
	Public           bool
	RequiresApproval bool
	ActiveMembers    int
	MaxMembers       int
}

var ownerOnly = map[string]bool{
	ActionEditSettings: true,
	ActionFinish:       true,
	ActionChangeRole:   true,
}

func JoinStatus(target JoinTarget, current *models.Membership, via string) (string, error) {
	if !target.Active {
		return "", ErrBolaoFinished
	}
	if current != nil {
		switch current.Status {
		case models.MemberStatusActive:
			return "", ErrAlreadyMember
		case models.MemberStatusPending:
			return "", ErrAlreadyRequested
		}
	}
	if via == JoinFromListing && !target.Public {
		return "", ErrBolaoNotPublic
	}
	if err := CanApprove(target); err != nil {
		return "", err
	}
	if target.RequiresApproval && via != JoinByInviteLink {
		return models.MemberStatusPending, nil
	}
	return models.MemberStatusActive, nil
}

func CanApprove(target JoinTarget) error {
	if target.ActiveMembers >= target.MaxMembers {
		return ErrBolaoFull
	}
	return nil
}

func CanManage(role, action string) bool {
	switch role {
	case models.MemberRoleOwner:
		return true
	case models.MemberRoleAdmin:
		return !ownerOnly[action]
	}
	return false
}

func CanRemove(actorRole, targetRole string, self bool) error {
	if self && actorRole == models.MemberRoleOwner {
		return ErrOwnerMustTransfer
	}
	if targetRole == models.MemberRoleOwner || !CanManage(actorRole, ActionRemoveMember) {
		return ErrForbidden
	}
	if actorRole == models.MemberRoleAdmin && targetRole == models.MemberRoleAdmin {
		return ErrForbidden
	}
	return nil
}

func CanLeave(role string) error {
	if role == models.MemberRoleOwner {
		return ErrOwnerMustTransfer
	}
	return nil
}

func RoleChange(actorRole, targetRole, newRole string) (string, string, error) {
	if !CanManage(actorRole, ActionChangeRole) {
		return "", "", ErrForbidden
	}
	switch newRole {
	case models.MemberRoleOwner, models.MemberRoleAdmin, models.MemberRoleParticipant:
	default:
		return "", "", ErrInvalidRole
	}
	if targetRole == models.MemberRoleOwner {
		return "", "", ErrOwnerMustTransfer
	}
	if newRole == models.MemberRoleOwner {
		return models.MemberRoleOwner, models.MemberRoleAdmin, nil
	}
	return newRole, actorRole, nil
}
