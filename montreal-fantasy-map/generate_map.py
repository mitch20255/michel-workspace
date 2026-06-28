"""
Carte fantasy de l'ile de Montreal.

Geometrie approximative (pas les polygones officiels de la Ville -- l'acces
reseau a donnees.montreal.ca / overpass-api.de etait bloque dans cet
environnement). Les contours sont places a la main a partir de reperes
geographiques connus, juste assez fideles pour etre reconnaissables une fois
stylises en carte de fantasy. A remplacer par le GeoJSON officiel si on veut
une precision cartographique reelle.
"""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch, Polygon as MplPolygon, FancyArrowPatch
from matplotlib.font_manager import FontProperties

rng = np.random.default_rng(42)

SERIF = FontProperties(family="FreeSerif")
SERIF_B = FontProperties(family="FreeSerif", weight="bold")

LON0, LAT0 = -73.65, 45.50


def proj(lon, lat):
    """Local equirectangular projection centered on Montreal, lat-corrected."""
    x = (lon - LON0) * np.cos(np.radians(LAT0))
    y = lat - LAT0
    return x, y


def densify(points, factor=10):
    pts = np.array(points, dtype=float)
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        for t in np.linspace(0, 1, factor, endpoint=False):
            out.append(a + (b - a) * t)
    return np.array(out)


def wobble(points, amp=0.012, seed=0, harmonics=(3, 7, 13, 21)):
    """Hand-drawn jitter: closed polygon perturbed along its normal by a
    sum of sine harmonics with random phase (smooth, no self-intersections)."""
    pts = densify(points, factor=14)
    n = len(pts)
    t = np.linspace(0, 1, n, endpoint=False)
    rs = np.random.default_rng(seed)
    offset = np.zeros(n)
    for k in harmonics:
        phase = rs.uniform(0, 2 * np.pi)
        offset += (amp / k) * np.sin(2 * np.pi * k * t + phase)
    nxt = np.roll(pts, -1, axis=0)
    prv = np.roll(pts, 1, axis=0)
    tangent = nxt - prv
    tlen = np.linalg.norm(tangent, axis=1)
    tlen[tlen == 0] = 1
    tangent = tangent / tlen[:, None]
    normal = np.stack([-tangent[:, 1], tangent[:, 0]], axis=1)
    return pts + normal * offset[:, None]


def latlon_poly(lonlat_list, seed=0, amp=0.012):
    xy = [proj(lon, lat) for lon, lat in lonlat_list]
    return wobble(xy, amp=amp, seed=seed)


# ---------------------------------------------------------------------------
# Geometrie approximative de l'ile (sens horaire, pointe ouest -> pointe est
# le long de la rive sud (fleuve Saint-Laurent), retour par la rive nord
# (riviere des Prairies)).
# ---------------------------------------------------------------------------
ISLAND = [
    (-73.97, 45.405),  # pointe ouest (Sainte-Anne-de-Bellevue)
    (-73.90, 45.408),
    (-73.83, 45.418),  # Lachine (legere avancee)
    (-73.74, 45.430),
    (-73.66, 45.440),
    (-73.605, 45.448),  # LaSalle / Verdun
    (-73.575, 45.462),  # Pont Champlain / Sud-Ouest
    (-73.558, 45.485),  # Vieux-Port
    (-73.535, 45.515),  # Hochelaga
    (-73.508, 45.555),  # Mercier
    (-73.497, 45.598),  # Pointe-aux-Trembles approche
    (-73.492, 45.665),  # pointe est
    (-73.523, 45.665),
    (-73.555, 45.645),
    (-73.585, 45.620),  # Montreal-Nord
    (-73.625, 45.600),  # Saint-Leonard
    (-73.665, 45.582),  # Ahuntsic
    (-73.705, 45.565),
    (-73.745, 45.548),  # Saint-Laurent (nord)
    (-73.79, 45.528),
    (-73.835, 45.505),
    (-73.875, 45.478),  # Pierrefonds
    (-73.92, 45.448),
    (-73.97, 45.405),
]

ILE_BIZARD = [
    (-73.90, 45.50), (-73.875, 45.515), (-73.855, 45.50),
    (-73.865, 45.485), (-73.895, 45.485),
]

ILE_JEAN_DRAPEAU = [
    (-73.535, 45.512), (-73.522, 45.518), (-73.518, 45.508),
    (-73.527, 45.498), (-73.540, 45.502),
]

ILE_DES_SOEURS = [
    (-73.545, 45.462), (-73.533, 45.468), (-73.528, 45.458),
    (-73.540, 45.452),
]

# ---------------------------------------------------------------------------
# Royaumes / duches / comtes -- noms fantasy inspires de la vraie toponymie
# (Ville-Marie = nom fondateur de Montreal en 1642, Hochelaga = village
# iroquoien rencontre par Cartier en 1535, Anjou = province francaise, etc.)
# ---------------------------------------------------------------------------
REGIONS = [
    # (nom fantasy, lon, lat, taille_police, icone, rayon_territoire, label_dx, label_dy)
    ("ROYAUME DE\nVILLE-MARIE", -73.552, 45.485, 12, "crown", 0.014, 0.030, -0.014),
    ("Cite-Libre de\nWestmount", -73.615, 45.477, 8, "tower", 0.011, -0.022, -0.014),
    ("Duche du\nPlateau", -73.580, 45.522, 9, "shield", 0.013, 0.005, 0.026),
    ("Marche\nd'Outremont", -73.608, 45.520, 8, "shield", 0.011, -0.040, 0.020),
    ("Comte de\nCote-des-Neiges", -73.625, 45.487, 8, "shield", 0.013, 0.030, -0.035),
    ("Terres du\nSud-Ouest", -73.585, 45.472, 8, "shield", 0.012, -0.010, -0.034),
    ("Forteresse-Ile\nde Verdun", -73.567, 45.458, 7, "tower", 0.010, 0.024, -0.040),
    ("Domaine de\nLaSalle", -73.633, 45.430, 8, "shield", 0.012, -0.014, -0.026),
    ("Port de\nLachine", -73.67, 45.435, 7, "anchor", 0.010, -0.010, 0.024),
    ("Marche\nSaint-Laurent", -73.685, 45.505, 8, "shield", 0.016, -0.024, 0.026),
    ("Terres\nd'Ahuntsic", -73.675, 45.555, 8, "shield", 0.014, -0.020, 0.024),
    ("Comte de\nVilleray", -73.625, 45.555, 8, "shield", 0.013, 0.000, 0.030),
    ("Comte de\nRosemont", -73.575, 45.555, 8, "shield", 0.013, 0.022, 0.026),
    ("ANCIEN ROYAUME\nD'HOCHELAGA", -73.535, 45.555, 10, "ruins", 0.015, 0.046, -0.004),
    ("Baronnie\nd'Anjou", -73.555, 45.612, 8, "shield", 0.013, 0.034, 0.012),
    ("Terres\nSaint-Leonard", -73.60, 45.598, 8, "shield", 0.012, -0.006, 0.028),
    ("Marche\ndu Nord", -73.645, 45.605, 7, "shield", 0.011, -0.034, 0.014),
    ("Confins de\nRiviere-des-Prairies", -73.53, 45.645, 8, "shield", 0.015, 0.020, 0.026),
    ("Foret de\nl'Ouest-de-l'Ile", -73.85, 45.48, 8, "tree-region", 0.030, 0.045, 0.055),
]

PARKS = [
    ("Mont-Royal", -73.5878, 45.504, "mountain"),
    ("Bois La Fontaine", -73.571, 45.527, "forest"),
    ("Foret d'Angrignon", -73.604, 45.448, "forest"),
    ("Bois Maisonneuve", -73.55, 45.557, "forest"),
    ("Bois-de-Liesse", -73.755, 45.515, "forest"),
    ("Bois de la Visitation", -73.65, 45.555, "forest"),
]

RAPIDES_LACHINE = (-73.715, 45.422)


# ---------------------------------------------------------------------------
# Couleurs "parchemin"
# ---------------------------------------------------------------------------
INK = "#4a3728"
INK_LIGHT = "#6b5440"
PARCHMENT = "#ecdcae"
PARCHMENT_DARK = "#e0c98f"
WATER = "#bcd6d6"
GOLD = "#a8762f"


def draw_water_texture(ax, xlim, ylim, seed=1):
    rs = np.random.default_rng(seed)
    ys = np.arange(ylim[0], ylim[1], 0.014)
    for y in ys:
        x = np.linspace(xlim[0], xlim[1], 120)
        wob = 0.004 * np.sin(x * 60 + rs.uniform(0, 6)) + 0.002 * np.sin(x * 23 + rs.uniform(0, 6))
        ax.plot(x, y + wob, color="#7fa3a3", linewidth=0.5, alpha=0.45, zorder=1)


def draw_land(ax, poly_xy, fill=PARCHMENT, edge=INK, lw=2.2, zorder=2, hatch=None):
    p = MplPolygon(poly_xy, closed=True, facecolor=fill, edgecolor=edge,
                   linewidth=lw, zorder=zorder, hatch=hatch, joinstyle="round")
    ax.add_patch(p)
    return p


def draw_tree(ax, x, y, scale=1.0, seed=0):
    rs = np.random.default_rng(seed)
    dx, dy = rs.uniform(-0.003, 0.003), rs.uniform(-0.003, 0.003)
    x, y = x + dx, y + dy
    s = 0.008 * scale
    ax.add_patch(MplPolygon([(x - s, y - s * 0.2), (x + s, y - s * 0.2), (x, y + s * 1.6)],
                             facecolor="#5b7048", edgecolor=INK, linewidth=0.6, zorder=5))
    ax.plot([x, x], [y - s * 0.2, y - s * 0.9], color=INK, linewidth=0.8, zorder=4)


def draw_forest(ax, x, y, n=9, radius=0.014, seed=0):
    rs = np.random.default_rng(seed)
    for i in range(n):
        ang = rs.uniform(0, 2 * np.pi)
        r = radius * np.sqrt(rs.uniform(0, 1))
        draw_tree(ax, x + r * np.cos(ang), y + r * np.sin(ang), scale=rs.uniform(0.7, 1.3), seed=seed * 100 + i)


def draw_mountain(ax, x, y):
    peaks = [(-0.018, 0.022, 0.014), (0.0, 0.030, 0.0), (0.016, 0.020, 0.012)]
    for dx, h, base_off in peaks:
        px = x + dx
        ax.add_patch(MplPolygon([(px - 0.013, y), (px + 0.013, y), (px, y + h)],
                                 facecolor="#9c8a6e", edgecolor=INK, linewidth=1.0, zorder=6))
        ax.add_patch(MplPolygon([(px - 0.004, y + h * 0.72), (px + 0.004, y + h * 0.72), (px, y + h)],
                                 facecolor="#f4f4f4", edgecolor=INK, linewidth=0.6, zorder=7))
    ax.text(x, y - 0.026, "Mont-Royal\n(Montagne Sacree)", ha="center", va="top",
            fontsize=8.5, fontproperties=SERIF_B, color=INK, zorder=12,
            style="italic", bbox=dict(boxstyle="round,pad=0.15", facecolor=PARCHMENT, edgecolor="none", alpha=0.8))


def draw_crown(ax, x, y, s=0.020):
    base_y = y - s * 0.55
    pts = [(x - s, base_y), (x - s, base_y + s * 0.5), (x - s * 0.55, base_y + s * 0.25),
           (x - s * 0.25, base_y + s * 1.0), (x, base_y + s * 0.45), (x + s * 0.25, base_y + s * 1.0),
           (x + s * 0.55, base_y + s * 0.25), (x + s, base_y + s * 0.5), (x + s, base_y)]
    ax.add_patch(MplPolygon(pts, facecolor=GOLD, edgecolor=INK, linewidth=1.1, zorder=9))
    for dx in (-s * 0.55, 0, s * 0.55):
        ax.add_patch(plt.Circle((x + dx, base_y + s * 0.42), s * 0.13, facecolor="#b0463f",
                                 edgecolor=INK, linewidth=0.6, zorder=10))


def draw_tower(ax, x, y, s=0.011):
    ax.add_patch(plt.Rectangle((x - s * 0.6, y), s * 1.2, s * 1.4, facecolor="#c9b48a",
                                edgecolor=INK, linewidth=0.8, zorder=9))
    for i in range(3):
        ax.add_patch(plt.Rectangle((x - s * 0.6 + i * s * 0.45, y + s * 1.4), s * 0.25, s * 0.3,
                                    facecolor="#c9b48a", edgecolor=INK, linewidth=0.6, zorder=9))


def draw_shield(ax, x, y, s=0.009):
    pts = [(x - s, y + s), (x + s, y + s), (x + s, y - s * 0.2), (x, y - s * 1.3), (x - s, y - s * 0.2)]
    ax.add_patch(MplPolygon(pts, facecolor="#b0463f", edgecolor=INK, linewidth=0.7, zorder=9))


def draw_anchor(ax, x, y, s=0.011):
    ax.plot([x, x], [y - s, y + s], color=INK, linewidth=1.3, zorder=9)
    ax.add_patch(plt.Circle((x, y + s), s * 0.32, facecolor="none", edgecolor=INK, linewidth=1.0, zorder=9))
    ax.add_patch(MplPolygon([(x - s, y - s * 0.9), (x - s * 0.4, y - s * 1.3), (x, y - s * 0.7)],
                             facecolor=INK, zorder=9))
    ax.add_patch(MplPolygon([(x + s, y - s * 0.9), (x + s * 0.4, y - s * 1.3), (x, y - s * 0.7)],
                             facecolor=INK, zorder=9))


def draw_ruins(ax, x, y, s=0.011):
    for i, h in enumerate([0.7, 1.2, 0.5, 1.0]):
        ax.add_patch(plt.Rectangle((x - s * 1.6 + i * s, y), s * 0.6, s * h, facecolor="#a08f6f",
                                    edgecolor=INK, linewidth=0.6, zorder=9))


def draw_ship(ax, x, y, s=0.014, seed=0):
    ax.add_patch(MplPolygon([(x - s, y), (x + s, y), (x + s * 0.6, y - s * 0.4), (x - s * 0.6, y - s * 0.4)],
                             facecolor="#8a6a45", edgecolor=INK, linewidth=0.7, zorder=6))
    ax.plot([x, x], [y, y + s * 1.8], color=INK, linewidth=0.8, zorder=6)
    ax.add_patch(MplPolygon([(x, y + s * 1.8), (x, y + s * 0.5), (x + s * 1.1, y + s * 0.9)],
                             facecolor="#f0e6d2", edgecolor=INK, linewidth=0.5, zorder=6))


def draw_sea_monster(ax, x, y, s=0.022):
    xs = np.linspace(-1, 1, 60) * s
    ys = 0.5 * s * np.sin(xs / s * 3.0)
    ax.plot(x + xs, y + ys, color=INK, linewidth=2.2, zorder=6)
    hx, hy = x + xs[0], y + ys[0]
    ax.add_patch(plt.Circle((hx, hy), s * 0.22, facecolor="#5b6e55", edgecolor=INK, linewidth=1.0, zorder=7))
    ax.plot([hx - s * 0.05, hx + s * 0.18], [hy + s * 0.18, hy + s * 0.35], color=INK, linewidth=1.4, zorder=7)
    ax.text(x, y - s * 0.9, "Ici les Rapides\nengloutissent les imprudents", ha="center", va="top",
            fontsize=6.5, fontproperties=SERIF, color=INK, style="italic", zorder=8)


def draw_compass_rose(ax, x, y, s=0.05):
    for ang, length, lab in [(90, s, "N"), (0, s * 0.6, "E"), (180, s * 0.6, "O"), (270, s * 0.6, "S")]:
        rad = np.radians(ang)
        ax.plot([x, x + length * np.cos(rad)], [y, y + length * np.sin(rad)], color=INK, linewidth=1.3, zorder=10)
    star = MplPolygon(
        [(x + (s if i % 2 == 0 else s * 0.28) * np.cos(np.radians(90 + i * 45)),
          y + (s if i % 2 == 0 else s * 0.28) * np.sin(np.radians(90 + i * 45))) for i in range(8)],
        facecolor=GOLD, edgecolor=INK, linewidth=1.0, zorder=10)
    ax.add_patch(star)
    ax.text(x, y + s * 1.3, "N", fontsize=11, fontproperties=SERIF_B, ha="center", color=INK, zorder=11)


def draw_decorative_border(ax, xlim, ylim, margin=0.03):
    x0, x1 = xlim[0] + margin, xlim[1] - margin
    y0, y1 = ylim[0] + margin, ylim[1] - margin
    for off in (0, 0.012):
        ax.add_patch(plt.Rectangle((x0 - off, y0 - off), (x1 - x0) + 2 * off, (y1 - y0) + 2 * off,
                                    fill=False, edgecolor=INK, linewidth=1.6, zorder=20))
    s = 0.03
    for cx, cy in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        ax.add_patch(plt.Circle((cx, cy), s * 0.45, facecolor=GOLD, edgecolor=INK, linewidth=1.2, zorder=21))


ICONS = {
    "crown": draw_crown,
    "tower": draw_tower,
    "shield": draw_shield,
    "anchor": draw_anchor,
    "ruins": draw_ruins,
}


def main():
    xlim = (-0.34, 0.34)
    ylim = (-0.14, 0.21)
    fig_w = 22
    fig_h = fig_w * (ylim[1] - ylim[0]) / (xlim[1] - xlim[0])
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    ax.set_facecolor(PARCHMENT_DARK)

    draw_water_texture(ax, xlim, ylim, seed=7)

    island_xy = latlon_poly(ISLAND, seed=11, amp=0.010)
    draw_land(ax, island_xy)

    for blob, seed in [(ILE_BIZARD, 21), (ILE_JEAN_DRAPEAU, 22), (ILE_DES_SOEURS, 23)]:
        xy = latlon_poly(blob, seed=seed, amp=0.004)
        draw_land(ax, xy, lw=1.4)

    # rapides de Lachine : zone d'eau agitee + monstre
    rx, ry = proj(*RAPIDES_LACHINE)
    draw_sea_monster(ax, rx, ry)

    # navires sur le Saint-Laurent
    for lon, lat in [(-73.50, 45.475), (-73.62, 45.405), (-73.80, 45.40)]:
        sx, sy = proj(lon, lat)
        draw_ship(ax, sx, sy)

    # parcs / forets / montagne
    for name, lon, lat, kind in PARKS:
        x, y = proj(lon, lat)
        if kind == "mountain":
            draw_mountain(ax, x, y)
        else:
            draw_forest(ax, x, y, seed=hash(name) % 1000)
            ax.text(x, y - 0.020, name, ha="center", va="top", fontsize=6.5,
                    fontproperties=SERIF, color=INK, style="italic", zorder=8)

    # royaumes / duches / comtes
    for name, lon, lat, fsize, icon, territory_r, label_dx, label_dy in REGIONS:
        x, y = proj(lon, lat)
        if icon == "tree-region":
            draw_forest(ax, x, y, n=14, radius=territory_r * 0.8, seed=hash(name) % 1000)
        elif icon in ICONS:
            ICONS[icon](ax, x, y)
        lx, ly = x + label_dx, y + label_dy
        if abs(label_dx) > 0.001 or abs(label_dy) > 0.001:
            ax.plot([x, lx], [y, ly], color=INK_LIGHT, linewidth=0.5, linestyle=":", zorder=8)
        ax.text(lx, ly, name, ha="center", va="center",
                fontsize=fsize, fontproperties=SERIF_B if fsize >= 11 else SERIF,
                color=INK, zorder=9,
                bbox=dict(boxstyle="round,pad=0.15", facecolor=PARCHMENT, edgecolor="none", alpha=0.75))

    # bandeau-titre
    ax.text(0, ylim[1] - 0.012, "L'ILE DE MONT-ROYAL", ha="center", va="top",
            fontsize=30, fontproperties=SERIF_B, color=INK, zorder=15)
    ax.text(0, ylim[1] - 0.040, "dite jadis HOCHELAGA — royaumes, duches & comtes de l'ile",
            ha="center", va="top", fontsize=12, fontproperties=SERIF, style="italic", color=INK, zorder=15)

    # rose des vents
    draw_compass_rose(ax, xlim[1] - 0.09, ylim[1] - 0.10, s=0.035)

    # cartouche / legende
    leg_x0, leg_y0 = xlim[0] + 0.075, ylim[0] + 0.058
    leg_w, leg_h = 0.225, 0.072
    ax.add_patch(plt.Rectangle((leg_x0, leg_y0), leg_w, leg_h, facecolor=PARCHMENT,
                                edgecolor=INK, linewidth=1.2, zorder=14))
    ax.text(leg_x0 + leg_w / 2, leg_y0 + leg_h - 0.009, "LEGENDE", fontsize=8, fontproperties=SERIF_B,
            color=INK, zorder=15, ha="center")
    legend_lines = [
        "Montagne sacree = Mont-Royal",
        "Forets = bois enchantes",
        "Couronne = capitale",
        "Tour = cite independante",
        "Navires = voies fluviales",
        "Frontieres stylisees (non officielles)",
    ]
    for i, line in enumerate(legend_lines):
        ax.text(leg_x0 + 0.010, leg_y0 + leg_h - 0.019 - i * 0.0095, line, fontsize=6.0,
                fontproperties=SERIF, color=INK, zorder=15, ha="left")

    # echelle
    sx0, sy0 = leg_x0 + leg_w + 0.05, ylim[0] + 0.025
    bar_len = 0.0723  # ~ 5 km a cette latitude
    ax.plot([sx0, sx0 + bar_len], [sy0, sy0], color=INK, linewidth=2, zorder=15)
    for f in (0, 0.5, 1):
        ax.plot([sx0 + f * bar_len] * 2, [sy0 - 0.004, sy0 + 0.004], color=INK, linewidth=1.5, zorder=15)
    ax.text(sx0 + bar_len / 2, sy0 + 0.008, "5 km (~1.5 lieue)", ha="center", fontsize=6.5,
            fontproperties=SERIF, color=INK, zorder=15)

    draw_decorative_border(ax, xlim, ylim)

    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_facecolor(PARCHMENT_DARK)
    fig.tight_layout(pad=0.4)
    fig.savefig("montreal_fantasy_map.png", dpi=220, facecolor=PARCHMENT_DARK)
    print("saved montreal_fantasy_map.png")


if __name__ == "__main__":
    main()
