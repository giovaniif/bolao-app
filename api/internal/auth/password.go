package auth

import (
	"golang.org/x/crypto/bcrypt"
)

const DefaultPassword = "123"

// Hash de "123" para novos usuários (bcrypt cost 10)
var DefaultPasswordHash = mustHash(DefaultPassword)

func mustHash(pwd string) string {
	h, err := bcrypt.GenerateFromPassword([]byte(pwd), 10)
	if err != nil {
		panic(err)
	}
	return string(h)
}

func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
