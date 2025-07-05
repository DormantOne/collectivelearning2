document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize Firebase with just the projectId
        firebase.initializeApp({
            projectId: "collectivelearning-b4bb4",
        });

        // Get a Firestore instance
        const db = firebase.firestore();

        // Get the Firebase Functions instance
        const functions = firebase.functions();

        // Call the getConfig function to fetch the Firebase config
        const getConfig = functions.httpsCallable('getConfig');
        const result = await getConfig();
        const firebaseConfig = result.data;

        // Re-initialize Firebase with the full config
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app(); // if already initialized, use that one
        }

        // Now you can use the full Firebase services
        const fullDb = firebase.firestore();

        // Fetch team names from button text
        const teamButtons = document.querySelectorAll('.team-button');
        const teamNames = Array.from(teamButtons).map(button => {
            return button.textContent.trim().split(' ')[0].toLowerCase(); // Converts 'Red Team' to 'red'
        });

        // Check and initialize Firestore data for each team
        teamNames.forEach((teamName) => {
            const teamScoreRef = db.collection('teams').doc(teamName);

            teamScoreRef.get().then((doc) => {
                if (!doc.exists || typeof doc.data().score === 'undefined') {
                    console.log(`No data found for ${teamName}, initializing score to 0.`);
                    return teamScoreRef.set({ score: 0 });
                }
            }).catch((error) => {
                console.error(`Error accessing Firestore for ${teamName}:`, error);
            });
        });

        // Fetch quiz data from data.json
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                startQuiz(data);
            })
            .catch(error => {
                console.error('Error loading quiz data:', error);
                document.getElementById('question').textContent = 'Failed to load quiz data. Please check the console.';
            });

        function startQuiz(quizData) {
            const questionElement = document.getElementById('question');
            const choicesContainer = document.getElementById('choices-container');
            const submitButton = document.getElementById('submit');
            const feedbackElement = document.getElementById('feedback');
            const explanationElement = document.getElementById('explanation');

            const nextQuestionButton = document.createElement('button');
            nextQuestionButton.textContent = 'Next Question';
            nextQuestionButton.style.display = 'none';
            nextQuestionButton.addEventListener('click', generateQuestion);
            // Insert after the explanation div for better flow
            explanationElement.insertAdjacentElement('afterend', nextQuestionButton);


            let currentQuestion = {};

            function generateQuestion() {
                submitButton.disabled = false;
                submitButton.style.display = 'inline-block';
                nextQuestionButton.style.display = 'none';
                feedbackElement.textContent = '';
                explanationElement.style.display = 'none';
                document.getElementById('team-options').style.display = 'none';


                const randomIndex = Math.floor(Math.random() * quizData.length);
                currentQuestion = quizData[randomIndex];

                questionElement.textContent = currentQuestion.question;
                choicesContainer.innerHTML = '';

                currentQuestion.choices.forEach((choice, index) => {
                    const label = document.createElement('label');
                    const radioInput = document.createElement('input');
                    
                    radioInput.type = 'radio';
                    radioInput.name = 'choice';
                    radioInput.value = index;

                    // Wrap input in label for better alignment and accessibility
                    label.appendChild(radioInput);
                    // Add a space between the radio and the text
                    label.appendChild(document.createTextNode(' ' + choice));
                    
                    choicesContainer.appendChild(label);
                });
            }

            // Call updateScores here to populate initial scores
            updateScores();

            function checkAnswer() {
                const selectedChoice = document.querySelector('input[name="choice"]:checked');
                if (!selectedChoice) {
                    feedbackElement.textContent = 'Please select an option before submitting.';
                    return;
                }
                submitButton.disabled = true;
                submitButton.style.display = 'none';
                

                const selectedAnswerIndex = parseInt(selectedChoice.value, 10);
                const isCorrect = selectedAnswerIndex === currentQuestion.correct;

                if (isCorrect) {
                    feedbackElement.textContent = 'Correct!';
                    feedbackElement.style.color = 'green';
                    document.getElementById('team-options').style.display = 'block';
                    // If correct, the "Next Question" button will appear after team selection
                } else {
                    feedbackElement.textContent = 'Incorrect.';
                    feedbackElement.style.color = 'red';
                    nextQuestionButton.style.display = 'inline-block'; // Show next question button on incorrect
                }

                explanationElement.textContent = `Explanation: ${currentQuestion.explanation}`;
                explanationElement.style.display = 'block';
            }

            submitButton.addEventListener('click', checkAnswer);

            function updateScores() {
                let totalScore = 0;

                db.collection('teams').get().then((querySnapshot) => {
                    querySnapshot.forEach((doc) => {
                        const teamName = doc.id; // 'red', 'white', etc.
                        const teamScore = doc.data().score || 0;
                        totalScore += teamScore;

                        // Update individual team score in HTML
                        document.querySelector(`#score-${teamName} span`).textContent = teamScore;
                    });

                    // Update total score in HTML
                    document.querySelector('#total-score span').textContent = totalScore;
                }).catch((error) => {
                    console.error("Error getting documents: ", error);
                });
            }

            function logForTeam(team) {
                let teamLowerCase = team.toLowerCase();

                console.log(`Point scored for the ${teamLowerCase} team.`);
                
                const teamScoreRef = db.collection('teams').doc(teamLowerCase);

                db.runTransaction((transaction) => {
                    return transaction.get(teamScoreRef).then((teamScoreDoc) => {
                        if (!teamScoreDoc.exists) {
                            throw "Document does not exist!";
                        }

                        let newScore = (teamScoreDoc.data().score || 0) + 1;
                        transaction.update(teamScoreRef, { score: newScore });
                        return newScore;
                    });
                }).then((newScore) => {
                    console.log(`New score for the ${team} team is ${newScore}`);
                    updateScores();
                    generateQuestion(); // Move to the next question automatically after scoring
                }).catch((error) => {
                    console.log("Transaction failed: ", error);
                });
            }

            document.querySelectorAll('.team-button').forEach(button => {
                button.addEventListener('click', function() {
                    logForTeam(this.getAttribute('data-team'));
                });
            });

            generateQuestion(); // Initial question
        }
    } catch (error) {
        console.error("Error fetching Firebase configuration:", error);
    }
});
