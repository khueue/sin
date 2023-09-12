# UPGRADE_POINT.
# See: https://hub.docker.com/_/python/
# NOTE: See ScanCode's Python requirements: https://scancode-toolkit.readthedocs.io/en/latest/getting-started/install.html#install-prerequisites
FROM python:3.11.5-bookworm

RUN apt update

# RUN pip install scancode-toolkit[full]
RUN pip install scancode-toolkit

# # UPGRADE_POINT.
# # See: https://github.com/nexB/scancode-toolkit/releases
# # ENV SCANCODE_URL=https://github.com/nexB/scancode-toolkit/releases/download/v32.0.6/scancode-toolkit-v32.0.6_py3.10-linux.tar.gz
# ENV SCANCODE_URL=https://github.com/nexB/scancode-toolkit/releases/download/v32.0.6/scancode-toolkit-v32.0.6_py3.11-linux.tar.gz
# RUN wget ${SCANCODE_URL} \
# 	&& tar -xvf ./scancode-toolkit-*.tar.gz \
# 	&& rm -f ./scancode-toolkit-*.tar.gz \
# 	&& mv scancode-toolkit-*/ /scancode-toolkit

# # # ScanCode dependencies.
# # # See: https://scancode-toolkit.readthedocs.io/en/latest/getting-started/install.html#install-prerequisites
# # RUN apt install -y python3-dev libbz2-1.0 xz-utils zlib1g libxml2-dev libxslt1-dev libpopt0
# # RUN apt install -y python3

# # Prepare ScanCode database and run it from anywhere.
# WORKDIR /scancode-toolkit
# RUN ./scancode --help
# ENV PATH=/scancode-toolkit:$PATH

# UPGRADE_POINT.
# See: https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions
# RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
ARG NODE_MAJOR=20
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt update
RUN apt install -y nodejs
RUN npm install --global yarn

# UPGRADE_POINT.
# See: https://www.npmjs.com/package/ts-node
RUN yarn global add ts-node@10.9.1

# Useful for browsing files and the database.
RUN apt install -y less
RUN apt install -y sqlite3

WORKDIR /app

# Run tool from anywhere.
ENV PATH=/app:${PATH}

# Ignore irrelevant ScanCode warnings.
ENV PYTHONWARNINGS="ignore"

# Give Node more space.
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Pretty terminal with basic tab-completion.
# See: https://gist.github.com/scmx/242caa249b0ea343e2588adea14479e6
RUN apt install -y bash-completion
RUN echo '[[ $PS1 && -f /usr/share/bash-completion/bash_completion ]] && . /usr/share/bash-completion/bash_completion' >> ~/.bashrc
RUN echo 'export PS1="\n🐳 \[\033[1;36m\]sin.ts \[\033[1;34m\]\$PWD\[\033[0;35m\]\n\[\033[1;36m\]$ \[\033[0m\]"' >> ~/.bashrc

# Install Node modules when package.json changes.
COPY ./app/package.json ./
RUN yarn install

# Copy all app code.
COPY ./app/lib/ ./lib/
COPY ./app/*.* ./

# RUN pip install extractcode

ENTRYPOINT [ "bash" ]
