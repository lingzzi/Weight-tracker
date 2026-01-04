let openBottomSheet = document.getElementById("open-bottom-sheet")
const overlay = document.getElementById('overlay')

openBottomSheet.addEventListener("click", () => {
    overlay.style.display = 'flex';
    openBottomSheet.style.display = 'none';
})

overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
    overlay.style.display = 'none';
    openBottomSheet.style.display = 'block';
}})