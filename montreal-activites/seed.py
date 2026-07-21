"""Insère quelques activités d'exemple pour tester l'app. Lancer : python seed.py"""
import db

EXEMPLES = [
    {
        "title": "Marché des saveurs au Marché Jean-Talon",
        "description": "Produits locaux, terrasses et découvertes gourmandes en plein cœur de la Petite-Italie.",
        "category": "Resto / Bar", "neighborhood": "Petite-Italie",
        "address": "7070 Av. Henri-Julien", "price": "Gratuit (entrée)",
        "tags": "marché, gourmand, local", "status": "favori", "rating": 5,
    },
    {
        "title": "Coucher de soleil au Mont-Royal",
        "description": "Rando facile jusqu'au belvédère Kondiaronk pour la vue sur le centre-ville.",
        "category": "Plein air", "neighborhood": "Mont-Royal",
        "price": "Gratuit", "tags": "vue, rando, gratuit", "status": "a_faire", "rating": 0,
    },
    {
        "title": "Soirée jazz dans le Mile End",
        "description": "Petit bar intimiste avec des sets live tous les jeudis.",
        "category": "Musique", "neighborhood": "Mile End",
        "price": "$$", "tags": "jazz, soirée, live", "status": "a_faire", "rating": 0,
    },
    {
        "title": "Piste cyclable du Canal-de-Lachine",
        "description": "Balade à vélo le long du canal, arrêts cafés et pique-nique.",
        "category": "Sport", "neighborhood": "Sud-Ouest",
        "price": "Gratuit", "tags": "vélo, été, famille", "status": "fait", "rating": 4,
    },
    {
        "title": "Nuit blanche — expositions gratuites",
        "description": "Musées et galeries ouverts tard, navettes gratuites dans toute la ville.",
        "category": "Culture", "neighborhood": "Centre-ville",
        "start_date": "2026-02-28", "price": "Gratuit",
        "tags": "art, nocturne, festival", "status": "favori", "rating": 5,
    },
]


def run():
    db.init_db()
    existing = db.stats()["total"]
    if existing:
        print(f"{existing} activité(s) déjà présentes — rien d'ajouté.")
        return
    for e in EXEMPLES:
        db.create_activity(e)
    print(f"{len(EXEMPLES)} activités d'exemple ajoutées ✓")


if __name__ == "__main__":
    run()
