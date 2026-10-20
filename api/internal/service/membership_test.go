package service

import (
	"errors"
	"testing"

	"github.com/bolao-app/api/internal/models"
)

func openBolao() JoinTarget {
	return JoinTarget{Active: true, Public: true, RequiresApproval: false, ActiveMembers: 10, MaxMembers: 50}
}

func member(role, status string) *models.Membership {
	return &models.Membership{Role: role, Status: status}
}

func TestJoinStatus(t *testing.T) {
	approval := openBolao()
	approval.RequiresApproval = true
	private := openBolao()
	private.Public = false
	full := openBolao()
	full.ActiveMembers = 50
	finished := openBolao()
	finished.Active = false

	tests := []struct {
		name    string
		target  JoinTarget
		current *models.Membership
		via     string
		want    string
		wantErr error
	}{
		{"a code joins at once when the owner does not approve", openBolao(), nil, JoinByCode, models.MemberStatusActive, nil},
		{"a code makes a request when the owner approves", approval, nil, JoinByCode, models.MemberStatusPending, nil},
		{"an invite link from the owner joins at once even with approval", approval, nil, JoinByInviteLink, models.MemberStatusActive, nil},
		{"the public listing makes a request when the owner approves", approval, nil, JoinFromListing, models.MemberStatusPending, nil},
		{"a private bolão cannot be joined from the listing", private, nil, JoinFromListing, "", ErrBolaoNotPublic},
		{"a private bolão can be joined by code", private, nil, JoinByCode, models.MemberStatusActive, nil},
		{"a full bolão refuses new members", full, nil, JoinByInviteLink, "", ErrBolaoFull},
		{"a finished bolão refuses new members", finished, nil, JoinByCode, "", ErrBolaoFinished},
		{"an active member cannot join again", openBolao(), member(models.MemberRoleParticipant, models.MemberStatusActive), JoinByCode, "", ErrAlreadyMember},
		{"a pending request is not repeated", approval, member(models.MemberRoleParticipant, models.MemberStatusPending), JoinByCode, "", ErrAlreadyRequested},
		{"a removed member can ask again", approval, member(models.MemberRoleParticipant, models.MemberStatusRemoved), JoinByCode, models.MemberStatusPending, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := JoinStatus(tt.target, tt.current, tt.via)
			if !errors.Is(err, tt.wantErr) || got != tt.want {
				t.Errorf("JoinStatus = %q, %v; want %q, %v", got, err, tt.want, tt.wantErr)
			}
		})
	}
}

func TestCanApprove(t *testing.T) {
	full := openBolao()
	full.ActiveMembers = 50
	if err := CanApprove(openBolao()); err != nil {
		t.Errorf("room left: err = %v, want nil", err)
	}
	if err := CanApprove(full); !errors.Is(err, ErrBolaoFull) {
		t.Errorf("full: err = %v, want ErrBolaoFull", err)
	}
}

func TestCanManage(t *testing.T) {
	tests := []struct {
		role   string
		action string
		want   bool
	}{
		{models.MemberRoleOwner, ActionEditSettings, true},
		{models.MemberRoleAdmin, ActionEditSettings, false},
		{models.MemberRoleOwner, ActionFinish, true},
		{models.MemberRoleAdmin, ActionFinish, false},
		{models.MemberRoleOwner, ActionChangeRole, true},
		{models.MemberRoleAdmin, ActionChangeRole, false},
		{models.MemberRoleOwner, ActionReviewRequests, true},
		{models.MemberRoleAdmin, ActionReviewRequests, true},
		{models.MemberRoleParticipant, ActionReviewRequests, false},
		{models.MemberRoleAdmin, ActionEditPayments, true},
		{models.MemberRoleParticipant, ActionEditPayments, false},
		{models.MemberRoleAdmin, ActionInvite, true},
		{models.MemberRoleParticipant, ActionInvite, false},
		{"", ActionInvite, false},
	}
	for _, tt := range tests {
		if got := CanManage(tt.role, tt.action); got != tt.want {
			t.Errorf("CanManage(%q, %q) = %v, want %v", tt.role, tt.action, got, tt.want)
		}
	}
}

func TestCanRemove(t *testing.T) {
	tests := []struct {
		name   string
		actor  string
		target string
		self   bool
		want   error
	}{
		{"the owner removes a participant", models.MemberRoleOwner, models.MemberRoleParticipant, false, nil},
		{"the owner removes an admin", models.MemberRoleOwner, models.MemberRoleAdmin, false, nil},
		{"an admin removes a participant", models.MemberRoleAdmin, models.MemberRoleParticipant, false, nil},
		{"an admin cannot remove another admin", models.MemberRoleAdmin, models.MemberRoleAdmin, false, ErrForbidden},
		{"nobody removes the owner", models.MemberRoleAdmin, models.MemberRoleOwner, false, ErrForbidden},
		{"a participant removes nobody", models.MemberRoleParticipant, models.MemberRoleParticipant, false, ErrForbidden},
		{"the owner cannot remove themself", models.MemberRoleOwner, models.MemberRoleOwner, true, ErrOwnerMustTransfer},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := CanRemove(tt.actor, tt.target, tt.self); !errors.Is(err, tt.want) {
				t.Errorf("CanRemove = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestCanLeave(t *testing.T) {
	if err := CanLeave(models.MemberRoleOwner); !errors.Is(err, ErrOwnerMustTransfer) {
		t.Errorf("owner leaves: err = %v, want ErrOwnerMustTransfer", err)
	}
	for _, role := range []string{models.MemberRoleAdmin, models.MemberRoleParticipant} {
		if err := CanLeave(role); err != nil {
			t.Errorf("%s leaves: err = %v, want nil", role, err)
		}
	}
}

func TestRoleChanges(t *testing.T) {
	tests := []struct {
		name       string
		actor      string
		target     string
		newRole    string
		wantTarget string
		wantActor  string
		wantErr    error
	}{
		{"the owner promotes a participant to admin", models.MemberRoleOwner, models.MemberRoleParticipant, models.MemberRoleAdmin, models.MemberRoleAdmin, models.MemberRoleOwner, nil},
		{"the owner demotes an admin", models.MemberRoleOwner, models.MemberRoleAdmin, models.MemberRoleParticipant, models.MemberRoleParticipant, models.MemberRoleOwner, nil},
		{"handing over the bolão makes the old owner an admin", models.MemberRoleOwner, models.MemberRoleAdmin, models.MemberRoleOwner, models.MemberRoleOwner, models.MemberRoleAdmin, nil},
		{"an admin cannot change roles", models.MemberRoleAdmin, models.MemberRoleParticipant, models.MemberRoleAdmin, "", "", ErrForbidden},
		{"the owner role of the owner does not change by itself", models.MemberRoleOwner, models.MemberRoleOwner, models.MemberRoleAdmin, "", "", ErrOwnerMustTransfer},
		{"an unknown role is refused", models.MemberRoleOwner, models.MemberRoleParticipant, "king", "", "", ErrInvalidRole},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, actor, err := RoleChange(tt.actor, tt.target, tt.newRole)
			if !errors.Is(err, tt.wantErr) || target != tt.wantTarget || actor != tt.wantActor {
				t.Errorf("RoleChange = %q, %q, %v; want %q, %q, %v", target, actor, err, tt.wantTarget, tt.wantActor, tt.wantErr)
			}
		})
	}
}
