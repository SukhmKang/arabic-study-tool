import io

import cv2
import numpy as np
from PIL import Image


def preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Returns binary: uint8 (224, 224), white background, dark letter.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr = np.array(img)

    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(gray, (224, 224), interpolation=cv2.INTER_CUBIC)

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Ensure dark letter on white background
    if np.mean(binary) < 127:
        binary = cv2.bitwise_not(binary)

    # Remove tiny speck noise while preserving small diacritic dots.
    binary = _remove_tiny_specks(binary, min_area=3)

    return _centre_letter(binary)


def _centre_letter(binary: np.ndarray) -> np.ndarray:
    inv = cv2.bitwise_not(binary)
    coords = cv2.findNonZero(inv)
    if coords is None:
        return binary

    x, y, w, h = cv2.boundingRect(coords)
    letter = binary[y : y + h, x : x + w]

    size = max(w, h)
    padded = np.full((size, size), 255, dtype=np.uint8)
    ox, oy = (size - w) // 2, (size - h) // 2
    padded[oy : oy + h, ox : ox + w] = letter

    return cv2.resize(padded, (224, 224), interpolation=cv2.INTER_CUBIC)


def _remove_tiny_specks(binary: np.ndarray, min_area: int = 3) -> np.ndarray:
    inv = cv2.bitwise_not(binary)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv)
    if n <= 1:
        return binary

    cleaned = np.zeros_like(inv)
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area >= min_area:
            cleaned[labels == i] = 255

    return cv2.bitwise_not(cleaned)
