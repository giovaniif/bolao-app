package footballdata

var teamNames = map[string]string{
	"Mineiro":       "Atlético-MG",
	"Paranaense":    "Athletico-PR",
	"Vasco da Gama": "Vasco",
	"Clube do Remo": "Remo",
}

func TeamName(shortName, name string) string {
	if ours, ok := teamNames[shortName]; ok {
		return ours
	}
	if shortName != "" {
		return shortName
	}
	return name
}
